---
title: Google File System
date: '2020-03-29'
categories: 
    - Distributed Systems
---

GFS 是谷歌开发的分布式文件系统，也是上一篇 [MapReduce](../google-map-reduce/) 最终输出文件的存放位置。

## 设计概述

以下内容简述了 GFS 的设计架构。包括系统的的细节，以及如此设计的原因。

### 假设

该系统在以下前提设计实现：

- 该系统由许多机器组成，这些机器经常会出错。所以系统必须持续检测以便能够检查、容忍错误，并且能够恢复回来。
- 该系统支持小型文件，但是不会对其作出优化。
- 关注性能的应用经常对一批读操作进行排序，以便提高性能。
- 在文件写入之后，很少会再次修改。
- 系统必须高效地处理好并发问题。
- 高且平稳的带宽比低延迟重要。

### 接口

GFS 提供了和文件系统类似的接口。文件以文件路径名严格组织。除了传统的 CRUD 之外，GFS 还提供了快照和 record append。快照能高效地复制一个文件或目录，record append 用来解决多个客户端的并发问题。

### 架构

一个 GFS 集群包括一个 master 和多个 chunkserver，同时 master 可以被多个 client 访问到。如图一。
文件通常被分为固定大小的 *chunk* 。在 chunk 被创建时，master 分配给它一个64位全局常量 *chunk handle* 。
chunkserver 将 chunk 作为 linux 文件存储在本地磁盘，并且根据 chunk handle 和字节区间进行读写。每个 chunk 在多个 chunkserver 上都有冗余。

![architecture](/pic/post/2020/03/google-file-system-1.png)

master 上保存了所有文件系统的元数据。包括命名空间，访问控制信息，文件到 chunk 的映射和 chunk 的位置。也控制像 chunk 租约，孤儿 chunk 的 GC，chunkserver 之间的 chunk 迁移等系统活动。master 还定期向 chunkserver 发送心跳包收集其状态。
client 与 master 交互来操作元数据，而对数据的操作直接与 chunkserver 通信。
client 和 chunkserver 都不缓存文件数据。一般对客户端来说，文件都太大了。而得益于 linux buffer cache，chunkserver 也不用再做缓存了（linux 会将访问的磁盘文件缓存在内存里）。

### 单点 master

单个 master 能够大幅降低设计的成本。但是也要减少其功能以免其成为系统的瓶颈。client 不通过 master 通信，而是向 master 请求应该与之通信的 chunkserver，同时缓存一段时间该信息以便后续的操作。

### chunk 大小

64MB，作为 chunk 的大小，看起来还是比传统的文件系统更大。每个 chunk 副本在 linux server 上作为普通文件保存，懒分配策略也避免了碎片造成的浪费。
大 chunk 带来了一些优点：

- 减少 client 与 master 的通信，对同一个 chunk 的读写只需要一次请求。对大文件由于是按顺序读写的，所以优势很明显，而小文件的随机读写也由于缓存而高效。
- 由于是大文件，许多操作都是实施在一个 chunk 上，而保持一个 TCP 常链接能够有效降低网络的负载。
- 同时，也减少了元数据的大小，这让内存中存储更多的元数据。

大 chunk，即使使用懒分配策略也有一些缺点：

- 可能一个文件只包含几个甚至只有一个 chunk 的情况，当许多客户端请求这个文件时，这些存储它的 chunkserver 就变成了热点。但是应用大多是还是顺序读取大型文件。在 GFS 被批处理系统使用的时候出现过这种问题：单 chunck 文件被写入 GFS 并在多台机器上执行而超载。解决方法之一就是允许在客户端之间读取数据。

### 元数据

master 主要存储三种主要类型的数据：文件和 chunk 命名空间，文件到 chunk 的映射，每个 chunk 副本的地址。三者都被存储在内存里，而前两者通过日志也被持久化到硬盘并备份到远程机器中。对于第三者，每在 master 启动，和一个 chunkserver 加入集群时 master 会向 chunkserver 询问 chunk 地址。

#### 内存中的数据结构

master 后台有定期扫描任务，对 chunk 的 GC、chunkserver 失败时重备份、chunkserver 间迁移进行扫描。

#### chunk 位置

向 chunkserver 请求地址而不是持久化到硬盘解决了 master 和 chunkserver 之间加入、离开集群，修改名称，失败，重启这些经常需要同步状态的问题。

#### 操作日志

操作日志非常重要，它记录了 master 元数据的变化，是 GFS 的核心。它不仅是元数据的唯一持久化记录，而且是并发操作在逻辑顺序上的日志。
由于其重要性，所以必须实现其可依赖性，并在写入 log 之前不能让 client 感受到元数据的变化。否则可能失去整个系统或客户端近期的操作。因此，必须在响应 client 操作前写入本地和远程磁盘，并在多个远程备份。在刷入磁盘前 master 会合并一批日志。

一旦 master 通过握手检测到 chunkserver 失败后，就会从一个有效的副本来恢复数据。当所有副本都不可用之后，那么这个 chunk 就不可逆的丢失了。即使是在这种情况，也是收到不可用的信息而不是损坏的数据。

### 一致性模型

GFS 拥有一个简单的一致性模型，对于相当分布式的系统来说足够简单和高效实现。

#### GFS 的保证

文件命名空间的变化是原子的。数据变化后的状态依赖于变化的种类[1]。

![architecture](/pic/post/2020/03/google-file-system-3.png)


#### 对应用的影响

附加而不是覆盖、检查点、写时自我校验、自我验证记录，这些是解决并发问题的手段。

## 系统相互作用

设计系统的目的之一是减少 master 的参与度。出于此目的，描述了 client, master 和 chunkserver 是如何实现数据修改、原子附加和快照的。

### 租约和变化（修改）的顺序

所有的变化都在全部 chunk 副本上体现出来。而为了保证各副本的变化的顺序，master 给其中一个副本(primary) chunk 租约，它把所有 chunk 发生的变化排序，其他副本根据该副本的变化顺序排序。

租约的设计目的是减轻 master 的负载。租约默认为60秒，只要 chunk 正在被修改，primay 可以向 master 请求，并且一般能无限期地收到 master 的扩展(extension)。master 和 chunkserver 之间定期交换心跳包，master 有时在租约过期之前取消租约。即使 master 和 primary 失去联系，也能在旧租约过期之后将新的租约给其他副本。

![data-flow](/pic/post/2020/03/google-file-system-2.png)

流程如图二：

1. client 向 master 请求当前持有租约的 chunkserver 和其他副本的地址。如果没有持有租约的，那么 master 就选择一个授予租约。
2. master 将 primary 的标识和其他副本的地址返回。客户端将这些数据缓存，当 master 不可用或副本不持有租约时需要再次和 master 联系。
3. client 以任意顺序将数据推送到所有副本。每个 chunkserver 将数据以 LRU 形式存储直到数据被使用或过期。
4. 一旦所有的副本都收到了数据，客户端向 primary 发出写请求。primary 将连续的序列号分配给所有收到的修改，这些修改可能是来自多个客户端的。
5. primary 将写请求同步给所有次要副本。每个副本都以相同的顺序应用修改。
6. 所有的次要副本都回复给 primary 表明它们完成了操作。
7. primary 回复给客户端，任意副本发生的错误都反馈给 client。在出错的情况下，写操作可能在 primary 和一部分副本上成功了。但是客户端请求被认为是失败的，并且修改区域处于一种易变的状态。客户端代码通过几次重试来解决这个问题。

如果一个写操作过大，那么 GFS 客户端会将其分解成多个写操作。这些操作可能和其他客户端的并发操作，但是请求最终会成功。

### 数据流

为了充分利用每个机器的带宽，数据以线性链式而不是以其他形式（如树）推送到 chunkserver。因此，每个机器的全部出站带宽都用于传输数据，而不是被多个接受者分流。

为避免网络瓶颈和链接高延迟，每个机器将数据传送给网络上最近的其他机器。

通过 TCP 流水线传输来降低延迟。只要一个 chunkserver 收到了数据，它马上开始转发。

### 原子记录附加

GFS 提供一个叫做 *record append* 的原子性附加操作。GFS 只保证每次写入一个原子单元，而不保证所有副本按字节一模一样。客户端需要额外的复杂且高代价的同步，如分布式锁管理。附加流程参加数据流图。

### 快照

快照是一个文件或目录的副本，应用标准的写时复制实现。当 master 收到快照请求时，它收回所有将要备份的 chunk 的租约。这保证了 master 首先创建备份。

在快照操作之后，客户端第一次想向 chunk C 中写入时，首先发送请求来找到目前租约持有者。客户端会注意到 C 的引用计数大于一。它推迟返回给客户端的请求，让每个 chunkserver 先创建一个 C 的副本 C‘。这样能够保证本地创建副本而不是通过网络创建。

## Master 操作

master 执行所有命名空间的操作。此外，它管理全系统的 chunk 备份。

### 命名空间管理和锁定

为了能让不同的 master 操作同时执行，通过锁定命名空间的区域来保证恰当的顺序。

命名空间树中的每个节点与一个读写锁关联，每个 master 操作在执行之前都会获取一组锁。

### 副本放置

在机器之间备份副本只能保证硬盘或机器失败，充分利用网络带宽。必须要将 chunk 副本在机架间备份，以此保证一个 chunk 的一些副本能够存活下来。

### 创建，重备份，重平衡

chunk 副本出于三个原因创建：创建，重备份，重平衡。

当副本的数量小于用户的目标时，就会发生重备份。chunk 之间根据优先级来确定备份的顺序。

master 定期重平衡副本，将当前的副本移动到更好的硬盘位置。同时也会删除空间不足的 chunkserver 上的副本。

### 垃圾收集

GFS 是懒删除的。

#### 机制

文件删除后，master 马上记录删除，但是不回收空间。在 master 定期扫描文件系统命名空间时，会删除已经存在三天的隐藏文件。在这之前，文件可以被读、恢复。在定期删除时 master 也会清理其相关的元数据。在心跳包的信息中，master 会告知 chunkserver 其不存在的元数据，之后 chunkserver 可以安全删除数据。

#### 讨论

要被删除的 chunk 在 master 维护的“应被删除映射”中。所有不被 master 所知的文件都是垃圾。

### 过期副本发现

当 chunkserver 失败并且丢失修改时，副本可能会过期。所以 master 为每个 chunk 维护一个版本号来区分。

每次 master 授予一个租约，版本号就增加并通知最新的副本。当 chunkserver 重启并报告 chunk 时，master 会检测到过期的副本。如果 master 发现了一个版本号比它还大的，master 就认为是在授予租约时候失败了，并尝试更高的版本号。

master 会在 GC 时移除过期的副本。当 master 通知 client 持有租约的 chunkserver 时，会携带当前 chunk 的版本号。

## 容错和诊断

设计该系统的最大挑战之一就是频繁的组件失败。

### 高可用

通过两个手段让整个系统高可用：快速恢复和冗余

#### 快速恢复

master 和 chunkserver 都被设计成存储它们的状态，并且无论是如何被停止都会在几秒内重启。

#### chunk 冗余

用户可以给命名空间的不同部分指定不同的冗余等级（默认3）。master 保证有足够的副本，同时通过校验和检测损坏的副本。

#### master 冗余

master 的操作日志和检查点被备份到多个机器上。只有在日志被刷入磁盘，一个修改才认为被提交了。shadow master 不像 mirror，它只有文件系统的读权限。shadow master 通过操作日志的副本来增加 primary master 相同的变化。

### 数据完整

每个 chunkserver 用检验和来检测数据的完整。校验和与其他元数据相同，存储在内存和日志中。chunkserver 在返回数据之前要校验校验和。如果不符合，就会返回错误，并报告给 master 不匹配。之后请求者就会去其他副本请求。即使之前的错误没有检测处理，之后的新校验和也不会是正确的。一旦 master 知道有错误，就会创建新的副本并删除不完整的副本。

### 诊断工具

大量的日志帮助诊断：包括 chunkserver 状态、RPC 请求等。

---

相比 MapReduce，GFS 的细节更多，但是很好理解。许多其他分布式系统的设计思想与之大体相同。比如租约、版本号，很容易联想到 [How to do distributed locking](/translation/2020/02/03/how-to-do-distributed-locking/)。懒删除又能够在 ES index 的删除中找到相似之处。后写日志可以联想到 MySQL，而写时复制在操作系统中更为常见。

[1] https://www.zhihu.com/question/20485173