---
title: Bitcoin, Blockchain, Ethereum
date: '2022-06-21'
categories: 
    - bitcoin
---

# 中本聪的愿望
> “传统货币最根本的问题在于信任。中央银行必须让人信任它不会让货币贬值，但历史上这种可信度从来都不存在。银行必须让人信任它能管理好钱财，并让这些财富以电子货币形式流通，但银行却用货币来制造信贷泡沫，使得私人财富缩水。”

1933年4月5日，为了使政府能够再印制更多现金注入市场，罗斯福总统签署了6102号行政命令，要求美国公民以每金衡盎司20.67美元的价格上交黄金，否则可处以10,000美元的罚款，甚至还可判处入狱服刑5至10年，同时也禁止黄金出口海外，以确保美国拥有的黄金不会外流。
{{< figure src="https://s2.loli.net/2022/06/21/jV6NfbAmLZOs2RB.png" title="Executive Order 6102">}}

罗斯福没收充公美国人的黄金，并以美元交换，然后让美元贬值了40%，强制推高黄金价，目的是让美国的债务贬值，从而对抗大萧条，造成的后果是美国人的财富被洗劫了40%。

1974 年，福特总统签署了 Public Law 93-373 即“黄金合法化法案”，1975年美国人可以再一次合法拥有黄金。
{{< figure src="https://s2.loli.net/2022/06/21/on7U1KjtDR8kgxc.png" title="Satoshi Nakamoto's Profile">}}

P2PFoundation 是中本聪发布比特币白皮书的网站，在这注册必须提供出生日期，中本聪填写的是1975年4月5日。

# 电子支付的问题
互联网上的贸易，几乎都需要借助金融机构作为可资信赖的第三方来处理电子支付信息。是这类系统仍然内生性地受制于“基于信用的模式”的弱点：
- 无法实现完全不可逆的交易，因为金融机构总是不可避免地会出面协调争端。
- 金融中介的存在增加交易的成本，并且限制了实际可行的最小交易规模，也限制了日常的小额支付交易。

**这些问题在物理现金交易中是不存在的。**

所以需要这样一种电子支付系统，它基于密码学原理而不基于信用，使得任何达成一致的双方，能够直接进行支付，从而不需要第三方中介的参与。

## 雅浦岛的故事
雅浦岛是一个金属资源比较匮乏的岛，就算是石灰岩也要去400英里以外的帕劳岛开采。雅浦岛部落里的探险家们开采这些石灰岩，打制成内部中空呈环形的石轮，然后用木筏运回雅浦岛作为货币使用。这些石轮小的直径30多厘米，大的直径有3米多。为了便于运输，有时会往中间插一根粗壮的木柱。开采难度越高，越漂亮，越大的石币价值越高。
{{< figure src="https://s2.loli.net/2022/06/21/zFaCbefmlY1Hod9.png" title="雅浦岛的石币">}}

雅浦石币有个很有趣的特点。交易双方在决定了使用多大的石币付费后，如果那个石头太大了，不方便运输，那么卖家只要在买家的石头上做个标记就可以了，这样就付费了。那个标记就说明这个石头已经属于卖家了，而石头仍然躺在买家屋里。
{{< figure src="https://s2.loli.net/2022/06/21/KuiDO8UY426qXyH.png" title="雅浦岛的石币">}}

岛上有一户首富，但没有人见过他家里的石币。他们家拥有的财产是一个巨大的石币，大小只有上上辈人才知道，因为这个石币一直沉睡在海底。这户人家的祖辈和其他人外出开采石灰岩并制成石币，在用木筏拉回家的归途中遭遇了强烈的暴风雨，为了逃命，探险队只好砍掉拉筏的绳子，于是那块巨大的石币沉入了大海。回村后探险队的成员都替他作证，虽然已掉落大海，但大伙都见证了这块石头的去处，所以不会影响它的价值，它的主人仍然可以用它去买东西，就跟把石币运回家存放起来的效果一样。

## 比特币和石币
如果雅浦岛首富想要私下使用这笔巨款，比如偷偷跟自己的情人说：我那块大石头送给你了。这次交易是无效的，因为交易没有广播，并没有其他岛民在旁边作证。但如果首富临死前，当着全岛人民的面说，这块大石头就作为遗产给我的大儿子了。那么这笔交易就是有效的，因为其他岛民都做了见证，并集体更新了头脑里的“账簿”。

假如雅浦岛上的交易越来越多，大家根本记不住这么多交易，所以打算使用比特币：
> 石币：大家都知道这个石币的所有人是村民1，那么他可以将其转账给村民2  
> 比特币：大家都知道这个比特币的所有人是村民1，那么他可以将其转账给村民2

在传统的交易中，采取的是**账户/余额模型**。比如银行账户、微信账户，都是基于账户/余额模型。
**账户内的余额是作为一个整体存在的。**

而比特币采用的是 **UTXO (Unspent Transaction Output) 模型**
{{< figure src="https://s2.loli.net/2022/06/21/qAb2Dczn8wNpI1f.png" title="BTC Transaction">}}

在比特币中，一笔交易的每一条输入和输出实际上都是 UTXO，输入 UTXO 就是以前交易剩下的， 更准确的说是以前交易的输出 UTXO。除了 coinbase 交易（挖矿奖励）没有输入 UTXO 之外，其它交易都有输入和输出，都可以为多个。在比特币中没有余额概念，只有分散到区块链里的 UTXO。

### 谁拥有 UTXO
在雅浦岛上，村民之间可以确定这个石币的所有者是谁。而比特币转账实际上是从一个地址被移动到另一个地址，当村民1想花费0.15个比特币时，如何证明自己拥有这个 UTXO，并且其他人无法假冒村民1来花费这个 UTXO 呢？

比特币的交易创建的输出其实并非一个简单的公钥地址，而是一个脚本。每一个比特币节点会通过同时执行这解锁和锁定脚本（**不是当前的锁定脚本，是指上一个交易的锁定脚本**）来验证一笔交易，脚本组合结果为真，则为有效交易。
{{< figure src="https://s2.loli.net/2022/06/21/6crY1BlWwi4zD7q.png" title="BTC 交易脚本">}}

这个脚本表达的意思是：谁的签名能匹配这个输出地址，钱就支付给谁。

所有人都可以验证村民1创建的这个新交易是否有效。如果有效，该交易就会被矿工打包进新的区块，从而成为区块链上不可更改的一部分。
> **什么是数字签名**
>
> A 给 B 发送消息前，先对消息生成摘要 (digest)，然后 A 使用私钥对摘要进行加密得到签名 (signature)。之后 A 将签名和消息一同发送给 B
>
> B 在得到消息后，可以使用公钥将签名解密得到 digest, 然后再与消息生成的 digest 进行对比，如果两个 digest 相同则说明消息没有被篡改。

**由于签名只能由私钥生成，所以谁拥有了私钥谁就拥有了这个 UTXO。**

以 [Pizza Transaction](https://www.blockchain.com/btc/tx/cca7507897abc89628f450e8b1e0c6fca4ec3f7b34cccf55f3f531c659ff4d79) 为例，提供的唯一一个 scriptSig 为
`30450221009908144ca6539e09512b9295c8a27050d478fbb96f8addbc3d075544dc41328702201aa528be2b907d316d2da068dd9eb1e23243d97e444d59290d2fddf25269ee0e01
042e930f39ba62c6534ee98ed20ca98959d34aa9e057cda01cfd422c6bab3667b76426529382c23f42b9b08d7832d4fee1d6b437a8526e59667ce9c4e9dcebcabb`

其中 `3045...ee0e` 是签名，`042e...abb` 是公钥。  
为了验证该交易是否有效，需要验证上一笔交易 [`a1075db5...d48d`](https://www.blockchain.com/btc/tx/a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d) 的输出
`1976a91446af3fb481837fadbb421727f9959c2d32a3682988ac`  
翻译后的比特币指令如下：  
`OP_DUP OP_HASH160 46af3fb4...6829 OP_EQUALVERIFY OP_CHECKSIG`

现在，有了签名，公钥和脚本就可以运行这个脚本来验证交易是否有效。
{{< figure src="https://s2.loli.net/2022/06/21/Uu4Rt37cxoqswJY.png" title="解锁脚本">}}

首先要准备一个空栈，然后把签名和公钥入栈，然后执行 OP_DUP，这条指令把栈顶的元素复制一份，所以结果变成：

||
|---|
|pubkey: 042e930f...cabb|
|pubkey: 042e930f...cabb|
|sig: 30450221...ee0e01|

然后可以执行TxOut的脚本：  
`OP_DUP OP_HASH160 46af3fb4...6829 OP_EQUALVERIFY OP_CHECKSIG`
{{< figure src="https://s2.loli.net/2022/06/21/vO3WDwFIkgA1LmY.png" title="验签">}}

执行 OP_HASH160，它对栈顶元素计算 SHA256/RipeMD160，实际上是计算公钥 Hash。再把数据入栈后运行结果变成：

||
|---|
|*data: 46af3fb4...6829*|
|*hash: 46af3fb4...6829*|
|pubkey: 042e930f...cabb|
|sig: 30450221...ee0e01|

最后，执行指令 OP_CHECKSIG 验证签名是否有效。

### 记账与挖矿
> 石币：两个人要交易时，把全村人都叫过来作见证，大家记在脑子里，或者记载自己的小本本上。  
> 比特币：两个人要交易时，向网络中所有节点广播。网络中各节点达成共识。

在比特币网络中，负责记账的节点被称为“矿工节点”。在用户发起交易时会向网络中广播交易，每个节点将收到的交易信息纳入一个区块中，并尝试在自己的区块中找到一个具有足够难度的工作量证明。当一个节点找到了一个工作量证明，它就向全网进行广播。
{{< figure src="https://s2.loli.net/2022/06/21/YG7vSlnBzV1bZjL.png" title="两个矿工节点各自挖到了一个区块">}}

当且仅当包含在该区块中的所有交易都是有效的且之前未存在过的，其他节点才认同该区块的有效性；其他节点表示他们接受该区块，在跟随该区块的末尾制造新的区块以延长该链条。矿工们在挖矿过程中会得到两种类型的奖励：创建新区块的新币奖励，以及区块中所含交易的交易费。

#### 双重支付
数字签名只能证明钱是本人转出的；哈希链只能保证篡改了账本的前一页、后一页就无效了。如果从账本上，把含有这笔转出交易的一页（以及后面的几页）撕掉，然后重新写一页，把原来那笔钱转给另一个地址，这就是**双重支付（双花）**。

想要“**中心化**”地实现“我转了钱，钱就不在我手里了”，就得需要一个共识算法来保障。比特币作为一个实质上的分布式数据库，各节点达成一致需要共识算法来协商。而 Paxos、Raft 等 Leader-Follower 模式的算法不符合去中心化的要求。比特币使用 **PoW (Proof-of-Work)** 在网络中达成共识。
{{< figure src="https://s2.loli.net/2022/06/21/hXYEiLsxTMNl9D2.png" title="两个矿工节点各自挖到了一个区块">}}

#### [HashCash](http://www.hashcash.org/papers/hashcash.pdf)
在垃圾邮件和 DDoS 中，攻击方几乎是没有代价的。垃圾邮件软件可以批量、高并发的发送邮件给目标地址； DDoS 可以利用海量的肉鸡对目标主机进行网络请求从而使目标主机限于瘫痪。

Hashcash 解决这些问题的手段是让攻击方付出一些计算资源的“代价”。首先，目标方会按照既定规则给出一道数学题，这道数学题的结果不可复用（每次请求需要重新计算）。为了得出结果，需要一些 CPU 的计算资源，然后把计算结果附在请求上提交给目标方，目标方可以非常轻易的验证结果是否正确。这道数学题的难度可以定义。

#### Bitcoin 中的 PoW
比特币 PoW 的过程，就是将不同的 nonce 值作为输入，尝试进行 SHA256 哈希运算，找出满足给定数量前导0的哈希值的过程。要求的前导0的个数越多，代表难度越大。
{{< figure src="https://s2.loli.net/2022/06/21/rOVRPAfyjG5EqW1.png" title="区块的数据结构">}}

比特币节点求解工作量证明问题的步骤归纳如下:
1. 生成铸币交易，并与其他所有准备打包进区块的交易组成区块，通过 Merkle 树算法生成 Merkle 根哈希；
2. 把 Merkle 根哈希及其他相关字段组装成区块头，将区块头的80字节数据作为工作量证明的输入；
3. 不停地变更区块头中的随机数 nonce，并对每次变更后的区块头做双重 SHA256 运算，将结果值与当前网络的目标难度做比对，如果满足难度条件，则解题成功，工作量证明完成。该矿工获得记账权，生成新区块并广播到全网。

# 以太坊
比特币脚本语言包含许多操作，但都故意限定为一种重要的方式——没有循环或者复杂流控制功能以外的其他条件的流控制。这样就保证了脚本语言的图灵非完备性，这意味着脚本的复杂性有限，交易可执行的次数也可预见。脚本并不是一种通用语言，施加的这些限制确保该语言不被用于创造无限循环或其它类型的逻辑炸弹，这样的炸弹可以植入在一笔交易中，通过引起拒绝服务的方式攻击比特币网络。受限制的语言能防止交易激活机制被人当作薄弱环节而加以利用。

## 智能合约
智能合约是一个计算机层面的交易协议，用于执行一系列的合约项。合约旨在满足一些常见的合约条件。在以太坊中，**智能合约是一个运行在以太坊链上的一个程序**。 它是位于以太坊区块链上一个特定地址的一系列代码（函数）和数据（状态）。
{{< figure src="https://s2.loli.net/2022/06/21/hqDX9eRj4IACKHv.png" title="EVM">}}

虽然以太坊有自己的本机加密货币 (ETH)，但与 BTC 遵循几乎完全相同的直观规则，但它也支持更强大的功能：智能合约。 对于此更复杂的功能，需要一个更复杂的类比：以太坊不是分布式账本，而是**分布式状态机**。以太坊的状态是一个大型数据结构，它不仅保存所有帐户和余额，而且还保存一个机器状态，它可以根据预定义的一组规则在不同的区块之间进行更改，并且可以执行任意的机器代码。 在区块中更改状态的具体规则由 EVM 定义。

```solidity
pragma solidity 0.8.7;

contract VendingMachine {

    // Declare state variables of the contract
    address public owner;
    mapping (address => uint) public cupcakeBalances;

    // When 'VendingMachine' contract is deployed:
    // 1. set the deploying address as the owner of the contract
    // 2. set the deployed smart contract's cupcake balance to 100
    constructor() {
        owner = msg.sender;
        cupcakeBalances[address(this)] = 100;
    }

    // Allow the owner to increase the smart contract's cupcake balance
    function refill(uint amount) public {
        require(msg.sender == owner, "Only the owner can refill.");
        cupcakeBalances[address(this)] += amount;
    }

    // Allow anyone to purchase cupcakes
    function purchase(uint amount) public payable {
        require(msg.value >= amount * 1 ether, "You must pay at least 1 ETH per cupcake");
        require(cupcakeBalances[address(this)] >= amount, "Not enough cupcakes in stock to complete this purchase");
        cupcakeBalances[address(this)] -= amount;
        cupcakeBalances[msg.sender] += amount;
    }
}
```
*自动贩卖机*
### Decentralized Application
去中心化应用 (DApp) 是在去中心化网络上构建的应用程序，结合了智能合约和前端用户界面。

DApp是去中心化应用程式，为用户提供功能和可用的前端。当智能合约、加密货币、区块链和应用程序结合在一起时，结果就是一个 DApp。DApp 与我们熟悉的手机应用程序非常相似，但存在一些关键差异。由于 DApp 与以太坊等区块链网络相关联，因此数据存储在区块链网络中的计算机上。这意味没有任何个人或团体控制 DApp。 

## Web3.0
就以太坊而言，Web3 指的是在区块链上运行的去中心化应用。 任何用户都可以参与以太坊上的这些应用，个人数据却不会被出卖。
{{< figure src="https://s2.loli.net/2022/06/21/P6DhqW9nNbf8cCJ.png" title="Web3.0">}}

Web 3.0基于区块链技术的发展，作为资产的数字内容发生了全方面的转变：平台不再是由某个中心化的公司管理，它变成了分布式的自组织（DAO），治理依靠社区投票；包括账号、钱包、道具、数字资产的所有权、控制权是用户的；无处不在的激励系统，让人们的网络行为更具经济理性。**数字内容由用户创造、用户所有、用户控制、协议分配。**

### DeFi
DeFi (Decentralized finance) 是金融产品和服务的统称，任何可以使用以太坊（具有互联网连接）的人都可以访问这些产品和服务。 有了 DeFi，市场始终开放，没有集中管理机构可以阻止付款或拒绝访问任何内容。 以前有可能出现人为错误的缓慢服务，替代为由任何人都可以检查和审查的代码来处理，变得自动和安全。

DeFi 使用加密货币和智能合约提供服务，无需中介。 在现代金融体系下，金融机构充当交易的担保人。 因为您的资产通过这些机构流通，从而为这些机构赋予了巨大的权力。 世界上还有数十亿人甚至无法使用银行账户。

在 DeFi，智能合约取代了交易中的金融机构。 智能合约是一种以太坊帐户，可以持有资金，并可以根据某些条件发送/退还资金。 智能合约上线时，没有人可以改变其有效期，它会始终按程序运行。

#### 借贷
去中心化借贷无需任何一方表明自己的身份即可进行。 但是，借款人必须提供抵押品，如果他们的贷款没有偿还，贷款人将自动获得抵押品。 有的贷款人甚至接受 NFT 作为抵押品。

#### 融资
二次方募资确保获得最多资金的项目是那些具有最独特需求的项目。 换句话说，就是那些能够改善大多数人生活的项目。
{{< figure src="https://s2.loli.net/2022/06/21/HfpYgl5jTaES921.png" title="Clean Air Task Force">}}

其运作方式如下：
1. 有一个相应的捐助资金库。
2. 开始一轮公共融资。
3. 人们可以通过捐资来表明对一个项目的需求。
4. 一旦这轮结束，匹配池的资金就会分配给项目。那些需求最独特的项目会从匹配池中获得最高金额。

#### 无损彩票
Pool Together 是这类项目中的首要代表。它成立于2019年9月，基于以太坊搭建，可定义为一种“无损彩票”，即哪怕玩家结局未中奖，也能收到本金返还而不必承受损失。以Pool Together 目前的 DAI 池子为例，一个奖励周期为一周，期间玩家们将资金（DAI）共同存入智能合约奖池，并获得对应数量的彩票（1DAI=1彩票）。在这一周内，PoolTogether 会将资金存放到借贷协议 Compound 上以赚取利息，这些利息将组成周末开奖时某一位随机获胜者的奖金。

{{< figure src="https://s2.loli.net/2022/06/21/tza7bs8ENcxi5kH.png" title="PoolTogether">}}

### NFT
NFT (Non-fungible tokens) ，即非同质化代币。介绍非同质化代币之前，先了解什么是同质化代币。

#### 同质化代币
同质化的加密代币遵循相同的同质化协议，这意味着这些同质化的代币可以进行交易置换。
就像是在一个游乐场，我们都需要把现金换成游戏币才能用这些游戏币去使用各种设施，你我的游戏币可以自由交换，因为我们两个的游戏币本质是相同的，我们交换时只会产生数量的变化，而质没有变。在区块链上，这些可置换的加密货币被称为同质化货币。

这些同质化货币具有一个特性——他们可以与其他基于相同协议的代币交换。比较流行的有以太坊的 ERC-20 协议。ERC-20 是较早的代币规格协议，若有两个代币都在以太坊平台上以 [ERC-20](https://ethereum.org/en/developers/docs/standards/tokens/erc-20/) 协议发行，那这两个代币之间就可以自由置换。

```solidity
function name() public view returns (string)
function symbol() public view returns (string)
function decimals() public view returns (uint8)
function totalSupply() public view returns (uint256)
function balanceOf(address _owner) public view returns (uint256 balance)
function transfer(address _to, uint256 _value) public returns (bool success)
function transferFrom(address _from, address _to, uint256 _value) public returns (bool success)
function approve(address _spender, uint256 _value) public returns (bool success)
function allowance(address _owner, address _spender) public view returns (uint256 remaining)

event Transfer(address indexed _from, address indexed _to, uint256 _value)
event Approval(address indexed _owner, address indexed _spender, uint256 _value)
```
*ERC-20 规范中需要实现的函数和事件*
{{< figure src="https://s2.loli.net/2022/06/22/DN3hPlVwHBA2GrM.png" title="苞米币，发行量10,000,000" link="https://ropsten.etherscan.io/token/0xb6eaefeaf86792bb97d1e2b4b27f1ba9e3512151">}}

同质化代币的另一个特性是它们的可分割性，意思是他们可以被分为最小单位来进行交换。就好比我们国家的法定货币最小单位是“分”，而比特币可以被分到最小单位satoshi(聪）（1聪=0.00000001比特币）。

#### 非同质化代币
NFT 是我们用以代表独特物品所有权的代币。 NFT 让我们把诸如艺术品、收藏品、甚至房地产等物品代币化。 他们一次只有一个正式主人，并且受到以太坊区块链的保护 - 没有人可以修改所有权记录或者根据现有的 NFT 复制粘贴一份新的。
{{< figure src="https://s2.loli.net/2022/06/21/DOtbrfpnEkUP2T6.jpg" title="我的第一个新版链上的 NFT">}}

NFT 不同于 DAI 或 LINK 等 ERC-20 代币，因为每个代币都完全独一无二、不可分割。 NFT 支持分配或声明任何独特数字数据的所有权，可通过使用以太坊的区块链作为公共账本进行追踪。 NFT 由代表数字或非数字资产的数字对象铸成。

NFT 一次只能有一个所有者。 通过唯一的 ID 和其他代币无法复制的元数据管理所有权。 NFT 通过智能合约铸造，智能合约分配 NFT 的所有权并管理它们的可转让性。 有人创建或铸造 NFT 时，他们会执行存储在符合不同标准的智能合约中的代码，如 ERC-721。

```solidity
function balanceOf(address _owner) external view returns (uint256);
function ownerOf(uint256 _tokenId) external view returns (address);
function safeTransferFrom(address _from, address _to, uint256 _tokenId, bytes data) external payable;
function safeTransferFrom(address _from, address _to, uint256 _tokenId) external payable;
function transferFrom(address _from, address _to, uint256 _tokenId) external payable;
function approve(address _approved, uint256 _tokenId) external payable;
function setApprovalForAll(address _operator, bool _approved) external;
function getApproved(uint256 _tokenId) external view returns (address);
function isApprovedForAll(address _owner, address _operator) external view returns (bool);

event Transfer(address indexed _from, address indexed _to, uint256 indexed _tokenId);
event Approval(address indexed _owner, address indexed _approved, uint256 indexed _tokenId);
event ApprovalForAll(address indexed _owner, address indexed _operator, bool _approved);
```
*ERC-721 规范中需要实现的函数和事件*

对于新手来说，刚了解 NFT 一定会被各种有如黑话般的术语弄得心慌意乱，由于 NFT 风潮最早起自国外，所以这些专有名词大多是英文，有些是沿袭自加密货币领域，或是借代现实世界的名词去表示虚拟的事物。

铸造 —— 通过智能合约发行一个 NFT
销毁 —— 某些项目方允许持有者销毁手中的 NFT
Drop —— NFT 开放购买的那一刻
AirDrop —— 免费发放 NFT 到用户的钱包当作奖励
白名单 —— 拥有优先购买的权利

## PoS
以太坊目前正在经历一系列升级，它将用[权益质押](https://ethereum.org/zh/staking/) 取代 PoW。这将移除作为安全机制的算力，并将以太坊的碳足迹减少约99.95%。

在 PoW 中，大家比拼的是“算力”（运算能力），通过大量运算得出符合难度的 Hash 值，从而得到奖励，亦无法预期是由谁产生下一个区块；而在 PoS (Proof-of-Staking) ，大家比拼的是“权益”，“权益”越大的人（节点）越大机会负责产生新区块，也就是说能够预期是由谁产生下一个区块。

假设这个系统中共有四个人：A 持有40个币、B 持有30个币、C 持有20个币、D 持有10个币。而这个"伪随机"的算法按他们持币的多少给予相应的成功概率，也就是说 A 成功被选择为产生新区块的概率比 D 要高4倍。  
然后给最后挑选出来的人权利，并给予一定时间内产生新区块，如果这个人在规定时间内没有产生出新区块，则再选出第二人来产生，如以类推。

### 缺点
1. 流动性差  
由于持币量越多，币龄越长，所得到的利息（奖励）也就越多，导致有很多人为获得丰富的奖励，而出现"屯币"的现象。
2. 存在权益粉碎攻击 Nothing-at-the-stake Attack 问题  
由于 PoS 不需要任何成本就可以产行新区块，导致若发生硬分叉的情况，如果这个分叉不被接受，实际上并没有任损失，所有持币者都会在两条链上持有相同数量的币，导致每条分支都会永远存在因为理性的矿工会同时在所有分支上挖矿，造成价值被降低，并存在被攻击的风险。

### 更绿色的以太坊
在 PoS 中，质押者投入资金而不是算力来确保网络安全。以太坊的能源消耗将变为一台家用电脑的运行成本乘以网络中的节点数量。 如果网络中有10,000个节点，家用计算机的运行成本约为每年525千瓦时。 整个网络每年需要5,250,000千瓦时。

简单对比一下，100,000 次 Visa 交易使用的能量为149千瓦时。 在 PoS 中，相同数量的交易会消耗17.4千瓦时的能量，约占总能量的11%。