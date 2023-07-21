---
title: 将 Gradle 构建的 Java 产物发布到 Maven 中央仓库和 GitHub Packages
date: '2023-07-20'
categories: 
    - build
---

日常开发中经常会抽象出一些常用的工具代码，这些代码可以作为三方包发布到中央仓库，在开一个新项目的时候直接引进来使用。  
除中央仓库之外，GitHub 也为开源项目提供了免费的 GitHub Packages 作为托管这些产物的平台。

所以本文会介绍一个将使用 Gradle 构建的 Java 项目产物，托管到 Maven 中央仓库和 GitHub Packages 的方案。

撰写本文时的环境如下：

| 依赖 | 版本 |
| --- | --- |
| Gradle | 8.2.1 |
| Java | java version "17.0.7" 2023-04-18 LTS |
| commit | [35256125ba7f3b0ba131b8721775576c0936c3a0](https://github.com/arjenzhou/bm-kit/tree/35256125ba7f3b0ba131b8721775576c0936c3a0) |

# 更严格的 Maven Central

对于 Release 发布来说，Maven 中央仓库对发布产物有着更严苛的要求。

- 需要对每个产物进行合法性校验
    - 每个产物需要上传 PGP 加密文件 *.asc
    - GPG 的公钥需要公网可见
- POM 中需要包含项目的名称、描述、地址、协议、开发者信息、仓库信息等
- Maven Central 区分 snapshot 和 release 的发布地址
- Maven Central 需要在 Nexus Repository Manager 上管理 release 产物

> 这里的 GPG 和 PGP 并不是 typo

所以，想要将代码发布到中央仓库的前提就清楚了（GitHub Packages 的前提更少）：

- 将代码打包成 Jar，并进行签名
    - 创建 GPG 密钥对
    - 将公钥发布到网络上，以便后续验证该签名的有效性
    - 打包成 Jar，使用该密钥签名
    - [可选] 打包 sources.jar, javadoc.jar 一并签名
- 根据产物是 snapshot 还是 release 来区分推送
- [如果是发布到中央仓库的 relase 产物] 到 Nexus Repository Manager 中 Close and Release

# 手动打包发布

首先一步步拆解打包发布的流程，这样能够更清楚每一步是在做什么。

## 中央仓库的注册

有关中央仓库如何注册，网上的指导有很多。这里总结一下步骤：
1. 注册 Sonatype 的账号，并提交一个 Ticket 上去，附带你的项目信息；
2. 在你的域名中增加一条 TXT 的 DNS 记录，内容是你的 Ticket ID（需要保证解析到你的域名上，所以一般 name 填 *, 代表根域名）
3. 在 Ticket 收到 Bot 回复后 Replay 一下，等待完成即可。

## 签名

如果安装 GPG、以及如何创建密钥在这篇[GPG入门教程](https://www.ruanyifeng.com/blog/2013/07/gpg.html)中讲得已经很清楚了，不再赘述。

在本地发布时，Gradle 会尝试读取环境中的 signing.keyId, signing.password 和 signing.secretKeyRingFile 三个变量，这三个变量的值是通过前面 GPG 生成的。你可以将它们 export 出来，也可以将它们写到 `.gradle/gradle.properties` 中，这样如果在不明确指定时，每次都会读取这些配置。

在 Gradle 中，提供了 `signing` 插件来对产物进行签名。这样，在执行 `gradle publish` 时会自动执行签名，来生成 *.asc 文件。

```kotlin
subprojects {
    ..
    apply(plugin = "maven-publish")
    apply(plugin = "signing")
    ..
    publishing {
        publications {
            register<MavenPublication>(project.property("artifact.id") as String) {
                ..
                signing {
                    sign(this@register)
                }
            }
        }
        repositories {
            ..
        }
    }
}
```

在这些配置完成之后，执行 `gradle publishToMavenLocal` 时，会将产物发布到本地的 Maven 仓库。在 ~/.m2/repository 目录下可以看到他们。

## 发布到仓库

同样地，Gradle 也提供了一个插件 `maven-publish` 用来将代码发布到 Maven 中。

既然需要推送到仓库，那么就要知道仓库的地址，及你的账号信息等。

```kotlin
subprojects {
    ..
    apply(plugin = "maven-publish")
    apply(plugin = "signing")
    ..
    publishing {
        publications {
            ..
        }
        repositories {
            maven {
                name = "GitHubPackages"
                url = uri("https://maven.pkg.github.com/${你的 GitHub ID}/${你的仓库 ID}")
                credentials {
                    username = System.getenv("GITHUB_ACTOR")
                    password = System.getenv("GITHUB_TOKEN")
                }
            }

            maven {
                name = "OSSRH"
                val snapshotsRepoUrl = uri("https://s01.oss.sonatype.org/content/repositories/snapshots/")
                val releasesRepoUrl = uri("https://s01.oss.sonatype.org/service/local/staging/deploy/maven2/")
                val isSnapshots = project.property("project.version").toString().endsWith("SNAPSHOT")
                url = if (isSnapshots) snapshotsRepoUrl else releasesRepoUrl
                credentials {
                    username = System.getenv("MAVEN_USERNAME")
                    password = System.getenv("MAVEN_PASSWORD")
                }
            }
        }
    }
}
```

这里 GitHub Packages 和 Maven Central 分开讨论：

- GitHub Packages 中的两个变量都是从 GitHub 的上下文中取出的，而不是用户自己输入的。 GITHUB_ACTOR 是用户的 ID，需要注意的是 GITHUB_TOKEN 不是密码。（这些放到后面解释）
- MAVEN_USERNAME 和 MAVEN_PASSWORD 就是在 Sonatype 注册的账号和密码。

中央仓库的配置完成之后，就可以将产物推送过去了。

# 利用 GitHub Action 发布

上一节介绍了如何在本地手动发布产物，所以自然地这一节会介绍如何自动发布。此处利用 GitHub Action 举例。  
回顾一下发布的流程：

1. 打包并签名
2. 发布

看起来很简单，所以流水线也这样配置就好了。但是问题出现了，前面的章节在本地配置了很多环境变量，放到流水线上该怎么搞呢？  
答案是使用 GitHub 仓库的 Variables，将这些参数配置成 Repository secrets 就可以实现了。

需要注意的一点是：
GPG 文件无法以文本的形式添加进去，所以通过 encode 再 decode 的方案来实现 GPG 文件的上传。在 MacOS 上可以利用 openssl 来对文件进行加密：`openssl base64 testin -out testout.txt`

将这些环境变量配置完成后，按步骤进行发布即可。

```yml
name: publish

on:
  release:
    types: [ created ]

env:
  GITHUB_ACTOR: ${{ secrets.GITHUB_ACTOR }}
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  MAVEN_USERNAME: ${{ secrets.OSSRH_USERNAME }}
  MAVEN_PASSWORD: ${{ secrets.OSSRH_TOKEN }}

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'adopt'
      - run: gradle build
      - run: echo "${{secrets.GPG_BASE64}}" > ~/.gradle/secring.gpg.base64
      - run: base64 -d ~/.gradle/secring.gpg.base64 > ~/.gradle/secring.gpg
      - run: gradle publish -Psigning.keyId=${{secrets.GPG_KEYID}} -Psigning.password=${{secrets.GPG_PASSWORD}} -Psigning.secretKeyRingFile=$(echo ~/.gradle/secring.gpg)
```


如此，在每次创建一个 release 时，该流水线都会自动在 GitHub Packages 和 Maven Central 进行发布。（中央仓库的 release 仍然需要手动 Close and Relase）