---
title: 我的网络环境（2026）
date: '2026-09-29'
categories: 
    - network
---

# 前言

四年前写过一篇[《我的网络环境》](/article/2022/08/network-topology/)，当时折腾网络的起因是想用 J4125 跑 PVE 搞 PS5 直播。四年过去了，直播早就不搞了，但家里的网络环境跟着生活变化一直在演进。

这篇文章算是对这四年来网络变迁的一个记录。

# ROS → iKuai

第一个变化是主路由。

2022 年用的 RouterOS，当时就吐槽过把登录密码忘了。用了一段时间后觉得 ROS 对家用场景太重了——配置全靠命令行，改个防火墙规则都得翻文档。后来换成了 iKuai，Web 界面点点就行，DHCP、流控、行为管理都是开箱即用。

OpenWrt 保留作为旁路由，只负责它擅长的事情。两者各司其职，iKuai 管路由和 DHCP，OpenWrt 管插件。

# 加入 MS-A1

后来入了一台 MS-A1，装了 PVE 跑虚拟机，上面有 Home Assistant 做智能家居、fnOS 当 NAS，还有一些其他服务。

当时的网络结构非常简单：J4125 WAN 口直连光猫，LAN 口只下挂了 MS-A1 和 K2P（当 AP 用），连交换机都不需要。

# 搬家

搬新家是网络环境变化最大的一次。

装修的时候做了一件正确的事：在弱电箱到各房间之间预埋了网线。书房、电视柜、厨房、两个卧室，各拉了一根。告别了之前到处拉明线的窘境。

光猫和 J4125 都在弱电箱里，J4125 LAN 口直接接到书房和电视柜，厨房和卧室的网口暂时预留。没有交换机，全靠 J4125 自带的网口。

# K2P → TP-Link & 中兴

搬了新家后房间多了，无线覆盖成了问题。

一开始把跟了我好几年的矿渣 K2P 设成 AP 顶着用，但覆盖和性能都不够看了。后来新买了 TP-Link 和中兴的路由器当 AP，书房和电视柜各放一台，有线回程到弱电箱交换机。覆盖问题彻底解决。

到这一步，网络拓扑大概是这样：

{{< mermaid >}}
graph TD
    ISP[光纤入户] --> ONT[光猫 192.168.1.1 拨号]

    subgraph J4125[J4125 PVE 主机 192.168.6.2]
        iKuai[iKuai 主路由 192.168.6.1]
        OpenWrt[OpenWrt 旁路由 192.168.6.3] --- iKuai
    end

    ONT --> iKuai
    iKuai --> StudyAP[书房 AP 192.168.6.5]
    iKuai --> TVAP[电视柜 AP 192.168.6.6]

    subgraph MSA1[MS-A1 PVE 192.168.6.10]
        HA[Home Assistant]
        fnOS[fnOS]
        other1[...]
    end
    iKuai --> MSA1
{{< /mermaid >}}

网段统一 `192.168.6.0/24`，一个 VLAN 都不需要。这套方案跑了很长时间，稳定省心。

直到——要装 IPTV。

# IPTV 来了

装 IPTV 这件事打破了原来简单的网络结构。

IPTV 的流量和普通上网流量需要隔离。运营商的 IPTV 走专门的组播 VLAN，光猫上有一个单独的 IPTV 口输出这路信号。机顶盒必须接在这个 VLAN 里才能正常收看。

问题在于：光猫在弱电箱，机顶盒在客厅电视柜，中间只有一根网线。这根网线既要给 AP 走上网流量，又要给机顶盒走 IPTV 流量。

一根线，两路流量，答案只有一个：**VLAN Trunk**。

解决方案有好几种，比如让软路由直接处理 VLAN 透传，但我选择了加**网管交换机**的方案——弱电箱一台，电视柜一台。原因是这样做拓扑最简洁，IPTV 流量完全在交换机层面隔离，不用改动软路由的任何配置，稳定性也更好。

J4125 WAN 口直连光猫这条线完全不用动——iKuai 继续老老实实做它的路由，IPTV 的事跟它没关系。

## 改造后的拓扑

{{< mermaid >}}
graph TD
    ISP[光纤入户] --> ONT

    subgraph 弱电箱
        ONT[光猫 192.168.1.1 拨号+IPTV]
        subgraph J4125[J4125 PVE 主机 192.168.6.2]
            iKuai[iKuai 主路由 192.168.6.1]
            OpenWrt[OpenWrt 旁路由 192.168.6.3<br/>udpxy 组播转单播] --- iKuai
        end
        SW1[网管交换机 8口 2.5G 192.168.6.11]
        ONT -->|上网口 直连| iKuai
        ONT -->|IPTV口| SW1
        iKuai <-->|Trunk 上网+IPTV| SW1
    end

    subgraph 书房
        StudySW[5口 2.5G 交换机]
        PC[电脑]
        StudyAP[AP 192.168.6.5]
        subgraph MSA1[MS-A1 PVE 192.168.6.10]
            HA2[Home Assistant]
            fnOS2[fnOS]
            other2[...]
        end
        StudySW --> PC
        StudySW --> StudyAP
        StudySW --> MSA1
    end
    SW1 --> StudySW

    SW1 --> Kitchen[厨房 预留]
    SW1 --> Bed1[卧室1 预留]
    SW1 --> Bed2[卧室2 预留]

    subgraph 电视柜
        SW2[网管交换机 5口 192.168.6.12]
        TVAP[AP 192.168.6.6]
        STB[IPTV 机顶盒]
        SW2 -->|上网 VLAN| TVAP
        SW2 -->|IPTV VLAN| STB
    end
    SW1 -->|Trunk 上网+IPTV| SW2

    style 弱电箱 fill:#f5f5f5,stroke:#999
    style 书房 fill:#f5f5f5,stroke:#999
    style 电视柜 fill:#f5f5f5,stroke:#999
    style J4125 fill:#dbeafe,stroke:#3b82f6
    style MSA1 fill:#dbeafe,stroke:#3b82f6
{{< /mermaid >}}

## VLAN 规划

整套方案只需要两个 VLAN：

| VLAN ID | 用途 | 说明 |
|---|---|---|
| 默认 VLAN | 上网 | iKuai 管理的 192.168.6.0/24 网段 |
| IPTV VLAN（运营商指定） | IPTV | 透传光猫的 IPTV 组播流量 |

> IPTV 的 VLAN ID 需要根据运营商的配置来定，可以通过光猫管理页面查看，各地不同。

## 弱电箱交换机（SW1）口分配

| 端口 | 用途 | VLAN 模式 |
|---|---|---|
| 口1 | 光猫 IPTV 口 | Access - IPTV |
| 口2 | J4125 iKuai LAN | Trunk - 上网 + IPTV |
| 口3 | 书房 | Access - 上网 |
| 口4 | 厨房（预留） | Access - 上网 |
| 口5 | 卧室1（预留） | Access - 上网 |
| 口6 | 卧室2（预留） | Access - 上网 |
| 口7 | 预留 | - |
| 口8 | 电视柜 Trunk | Trunk - 上网 + IPTV |

光猫上网口直连 J4125 WAN，不经过 SW1，所以比之前的方案省出一个口。

## 电视柜交换机（SW2）口分配

| 端口 | 用途 | VLAN 模式 |
|---|---|---|
| 口1 | Trunk 上联 | Trunk - 上网 + IPTV |
| 口2 | AP | Access - 上网 |
| 口3 | IPTV 机顶盒 | Access - IPTV |
| 口4-5 | 预留 | - |

## 几个细节

**改动量很小。** 弱电箱加一台网管交换机（SW1），电视柜加一台网管交换机（SW2），光猫 IPTV 口拉一根短线到 SW1，J4125 LAN 口从直连改接 SW1。J4125 WAN 口直连光猫不变。

**J4125 到 SW1 走 Trunk。** 因为要让 OpenWrt 能收到 IPTV 的组播流量做转换，所以这条线需要同时透传上网和 IPTV 两个 VLAN。PVE 里给 OpenWrt 加一个 IPTV VLAN 的虚拟网卡即可。有意思的是，这根线上两个 VLAN 的流量方向是反的——上网流量从 J4125 往下走到 SW1，IPTV 流量从 SW1 往上走到 J4125。这没有问题，以太网是全双工的，一根线可以同时双向传输。

**udpxy 组播转单播。** OpenWrt 上跑 udpxy，监听 IPTV VLAN 接口的组播流量，转成 HTTP 单播流。局域网内任何设备访问 `http://192.168.6.3:4022/udp/组播地址:端口` 就能看 IPTV，手机、平板、电脑都行。

**机顶盒照常工作。** 电视柜的机顶盒还是走 IPTV VLAN 直连，不受 udpxy 影响。两种看法并存。

**IPTV 流量的两条路径：**
- **机顶盒：** 光猫 IPTV 口 → SW1 → Trunk → SW2 → 机顶盒（二层直通）
- **其他设备：** 光猫 IPTV 口 → SW1 → Trunk → J4125 → OpenWrt udpxy → 上网 VLAN → 任意设备（组播转单播）

**书房交换机不用换。** 书房只有上网流量，普通交换机足够。

# IP 分配汇总

| 设备 | IP | 位置 |
|---|---|---|
| 光猫 | 192.168.1.1 | 弱电箱 |
| iKuai 主路由 | 192.168.6.1 | J4125 PVE |
| PVE 管理口 | 192.168.6.2 | J4125 PVE |
| OpenWrt 旁路由 | 192.168.6.3 | J4125 PVE |
| 书房 AP | 192.168.6.5 | 书房 |
| 电视柜 AP | 192.168.6.6 | 电视柜 |
| MS-A1 | 192.168.6.10 | 书房 |
| 弱电箱交换机 | 192.168.6.11 | 弱电箱 |
| 电视柜交换机 | 192.168.6.12 | 电视柜 |

# 后记

回头看这四年，网络架构的每一次变化都是被实际需求推着走的：ROS 不好用了换 iKuai，需要算力了上 MS-A1，搬家了重新布线加 AP，想看电视了搞 IPTV。没有一次是"为了折腾而折腾"——好吧，也许有一点。

弱电箱这个东西，永远比你想象的小。每次往里塞设备都是一场空间管理的战斗。
