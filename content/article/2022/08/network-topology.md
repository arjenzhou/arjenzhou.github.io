---
title: 我的网络环境
date: '2022-08-30'
categories: 
    - network
---

# 背景
故事发生在今年的2月。PS5到手没两天诞生了搞直播的想法，在摸索的过程中发现了《[搭建 PS4 本地直播服务器](https://homulilly.com/post/play-ps4-live-stream-at-local.html)》这篇帖子，于是就冒出了折腾的心思。毕竟花钱买采集卡有点冤大头的感觉。

之前家里的网络环境比较简单，只需要在 Openwrt 上装一些插件，所以一台在上学时候收的一个矿渣 K2P 就够了。

{{< figure src="https://s2.loli.net/2022/08/30/7dJkU4iIrhueqpW.png" title="矿渣 K2P">}}


后来因为 UU 的插件不够稳定，又搞了一个 UU 加速盒。
{{< figure src="https://s2.loli.net/2022/08/30/XnFu6aRpCyS5Uvk.jpg" title="垃圾 UU 加速盒">}}

但是如果想搞直播，就得每天在工作电脑上跑一个 docker，太麻烦了。

于是，我便斥巨资购入了一款 J4125 
{{< figure src="https://s2.loli.net/2022/08/30/u3Ca5fFdVrGUO78.jpg" title="J4125">}}

遗憾的是，尽管这款主机内置了 MSATA 和 SATA3.0 两款接口，但是没有能力容纳下一个 SATA3.0 的硬盘，所以在我手里变成了这样：
{{< figure src="https://s2.loli.net/2022/08/30/ekSHDZqGURTJFwY.jpg" title="外挂式硬盘，蚌埠住了">}}

# 软路由
> 过了半年回过头来看，其实根本没必要来搞一个性能远远溢出的 J4125，因为实际上只会跑几个性能开销很小的虚拟机。

搞这台小主机的目的是为了装一个 debian 来跑 nginx 拦截 PS5 的流量，而裸装 debian 有点不够划算，于是干脆个装 PVE 来个 all in one。
{{< figure src="https://s2.loli.net/2022/08/30/8IH6F3QqbtMxs49.png" title="All in PVE">}}

第一步，先把 ROS 和作为 AC 的 Openwrt 搞好，参考《[基于PVE+ROS+LEDE的软路由配置流程](https://www.cnblogs.com/Pyrokine/p/14526662.html)》，其中需要注意的是，Openwrt 的安装比较麻烦，需要后挂载。在设备联入网络时，根据网关设置为 ROS 或者 Openwrt，可以区分不同的网络环境实现按需科学上网。

# AP
按照上面引用的文章操作完成后，网络设备可以通过插网线的模式来上网了。但是现在都什么年代了还在用传统上网？所以把 K2P 设置成 AP，参考《[OpenWRT 设置桥接交换机模式（AP模式）](https://www.wyr.me/post/676)》，注意设置为交换机模式后就可以当 AP 使用，如果想通过无线连接到 AP 上需要设置客户端。

# PPPoE
4月9号的时候，由于工作调动搬了一次家，新的房子由于线路比较老，不能接入光纤，只能 PPPoE 拨号上网。所以需要对 ROS 做一些简单的调整，参考《[RouterOS(ROS)软路由PPPOE拨号上网配置指南(附授权镜像下载)](https://zhuanlan.zhihu.com/p/194360234)》

## Debian
前置工作就绪了，关键在于 Nginx 的搭建。先搞一个 Debian 起来用来跑 Nginx，参加开头的文章。目前的网络拓扑如下图

{{< figure src="https://s2.loli.net/2022/08/30/vJnMBT41m5gbU6x.png" title="网络拓扑">}}

过了一段时间我发现了一个更方便的方案，参考《[折腾PS5直接在B站直播](https://www.chiphell.com/thread-2399569-1-1.html)》。搞成了之后，不但能直播还能看弹幕了。
{{< figure src="https://s2.loli.net/2022/08/30/VOTufek5iItRzxL.png" title="推流成功后会有一条记录的，懒得弄了">}}

## 问题
这种方式有一个致命的问题：由于 UU 加速器有一层 NAT（无论是插件还是硬件），所以开加速器是无法直播的，也许是我功力不够深，没法解决～

## 后记
本来想写一篇比较详细的文章来介绍一下来着，但是由于时间太久了，当初折腾的细节都忘得差不多了。不过参考本文引用到的文章，自己再多折腾一下问题应该也不大。到现在为止最坑爹的问题就是我把 ROS 的登录密码忘掉了……不过善用 PVE 里面的 snapshot 很方便回滚。
（其实今天我想起来写这篇文章，是因为打算在主机里面再装一个 Windows 玩云顶之弈）[PVE安装Windows 11虚拟机 step by step](https://www.gordon2000.com/2021/10/pvewindows-11-step-by-step.html)

打个广告：[大连一方勇夺世界杯的直播间](http://live.bilibili.com/21205154)
