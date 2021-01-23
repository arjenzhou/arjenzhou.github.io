---
title: The analysis and modification of rules of ESLint
date: '2019-07-03'
categories:
  - Compiler Related
---

> 每个互联网大厂都有自己的编码规范，而对规范审查需要有代码扫描平台来对工程师的能力进行评估。在实习的两个月中，我负责的工作的一部分包括代码规范扫描方向，其中对 ESLint 以及 fecs 规则的修改及调整也包括在内。ESLint 在内部保留了一个仓库用于 JS 的规范检查，由于内部代码规范的问题，不可能直接将外部的拿来直接使用。对很少接触 JS 的我来说，npm 的包管理方式冗杂而烦乱，同时该模块是被集成在整个扫描平台中的，所以很少有有效的文档用来参考，通过不断地测试最后终于解决了该部分问题。

规则 **no-new** 要求 使用 **new** 关键字必须将其赋值给一个变量，如:

```JS
var Vue = new Vue({})
```

而内部规范在 **Vue** 中可以不赋值
```JS
new Vue({})
```
所以考虑对 **ESLint** 进行一些定制化配置。

查看官方文档无果之后，考虑找到开发人员，以下为交流过程：

> arjenzhou:
Hi, because I customized the rules, so I want to build and run eslint locally, what should I do?
>
> platinumazure:
@arjenzhou You should be able to install ESLint locally with npm install --save-dev eslint, and then run with ./node_modules/.bin/eslint. Am I missing something?
>
> arjenzhou:
@platinumazure
Thanks for your reply.
Because of my work, I must modify the original rule (no-new) and, I want to repackage(I don't know whether right or not because I haven't get touch js before) it with the source code and test it locally.
I think npm install will push eslint from npm repository, please correct me at your pleasure.
typo: push -> pull
>
> platinumazure:
@arjenzhou Your best option in this case is to create a custom rule, rather than trying to edit the original rule in-place.
See here for a way to pull in custom rules in a particular directory of your project. (Note: This assumes you don't intend to redistribute your custom no-new implementation. If you might want to redistribute it, you should look at creating a plugin.)
See here for how to create a rule. (In your case, you could either put the rule file in some directory in your project and then use --rulesdir to pull it in, or you could put the rule in a plugin.)
When creating your rule, you could copy the source of no-new and make the necessary changes.
Also, depending on the type of change, eslint-rule-composer could be a useful tool to help you create the rule.
>
> arjenzhou:
@platinumazure I am not going to use it in my project, rather than using it in all my projects so, I want to repackage it then I can use it global.
platinumazure:
@arjenzhou Then you'll want to create a plugin, publish it to an npm repository (maybe privately/within a scope), and use the rule from the plugin. All your projects can consume the plugin as a dependency or devDependency.
>
> arjenzhou:
Can I get the value of the node of AST?
I want to log the vaule of node and its child and parent nodes
@platinumazure
I notice the doc isn’t enough for me [https://eslint.org/docs/developer-guide/working-with-rules#contextreport](https://eslint.org/docs/developer-guide/working-with-rules#contextreport)
Finally I solve by [node.name](http://node.name/)
Thanks you a lot! @platinumazure

经过查看官方文档和咨询开发人员无果之后，考虑修改源码来定制规则，首先分析 ESLint 运作的原理。

## 抽象语法树

Javascript Parser 将 JS 代码转换成 AST，代码扫描工具通过 AST 对代码进行分析检查[1],之后，我们查看源码具体分析规则的实现。

## 规则：no-new[2]

<center>![](/pic/post/2019/07/2019-07-03-eslint/Untitled-e2c002d7-01d4-413c-901e-d4084403438c.png)</center>

<center>*图1，ESLint 中 no-new 规则实现部分代码[3]*</center> 

我们在官方文档[4]中找到红色方框中语句的含义：

<center>![](/pic/post/2019/07/2019-07-03-eslint/Untitled-99eae98f-2d7b-4c8d-87ff-9f29975d58a7.png)</center>

<center>*图2，官方文档部分对该规则的解释*</center>

结合对代码 AST 的分析，我们很容易得出结论，当 AST 符合红色方框中的情况时，即会触发规则。图3为代码 `new Vue({})` 的 AST，符合代码中 `ExpressionStatement > NewExpression(node)` 的情况，故能够触发规则。


<center>![](/pic/post/2019/07/2019-07-03-eslint/Untitled-0d1787ae-9dc0-42e8-96d0-b4347fdcd9e7.png)</center>

<center>*图3，触发 ESLint 规则的代码 `new Vue({})` 对应的语法树*</center>

而代码 `var vue = new Vue({})` 不触发 ESLint 的规则，其 AST 如图4所示。

<center>![](/pic/post/2019/07/2019-07-03-eslint/Untitled-2b64e0ae-9f2e-462c-86a0-3953e04c7299.png)</center>

<center>*图4，不会触发 ESLint 规则的代码 `var vue = new Vue({})` 对应的语法树*</center>

如此一来，我们只需要触发规则的情况中豁免掉 Vue 就能避免误报。修改后的代码如下：

<center>![](/pic/post/2019/07/2019-07-03-eslint/Untitled-1382d5f8-30cd-4162-9fc8-37f1cf87faf9.png)</center>

<center>*图5，修改后的代码，豁免了触发规则的情况*</center>

> 附: JS 语法树分析工具[5]

---

[1] https://segmentfault.com/a/1190000014389494  
[2] https://eslint.org/docs/rules/no-new  
[3] https://github.com/eslint/eslint/blob/master/lib/rules/no-new.js  
[4] https://eslint.org/docs/developer-guide/working-with-rules#rule-basics  
[5] https://astexplorer.net