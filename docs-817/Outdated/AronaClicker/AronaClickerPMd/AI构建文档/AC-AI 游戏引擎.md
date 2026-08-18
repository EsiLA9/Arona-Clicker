本文档用以说明ts的游戏引擎如何构建。

# 游戏数值引擎的结构

## Template 与静态资源
Template 定义了资源的：
- 绝对 id 
- 获得、升级后的影响
- 互相的链接

其中 TagTemplate/ValTemplate 所指向的 ValueMap 定义了 Template 下的：
- 实例应该具有什么样的子数值类型

## Instance 与动态联合




# 游戏数值设计 
## Template 
Template 是游戏的静态资源联合，由加载的Datapack构成。
Template 包含各子类，各个子类都会有不同的额外成员。
###### id 
id 为 DatapackName:TypeName:RealName 构成。
###### Archive 
Archive 是存储与管理 Template 的综合机构，允许用户使用 DatapackName:TypeName:RealName 快速查询到 Template 信息。当然也有 DatapackName:RealName ~ TypedTemplate 便捷查询方法，以及其他操作。
### Template 的类型
- Init 
	- 子成员需要 defaultArea 
- Area 
	- 子成员需要 parentInit 
- Spot 
	- 子成员需要 parentArea 
- Upgrade 
	- 子成员需要 parentArea/parentSpot 
- Character 
	- 子成员需要 parentInit 
- Resource 
	- 唯一允许tick自增的项目 
- Story 
- PassiveStory 
- Tag 
	- 需要 TemplateType 与其他配置
- Val 
	- 需要 TagSet 


## Instance
Instance 是游戏当前的动态资源，必须指向Template。动态资源可能是一个数据实体，也可能是简单的数据元。

# 数值元GameNum
数值元是游戏底层的数值关系，分为
数值元与实体 Instance 与各类 Template 相绑定。它本体使用BigInt作为底层数，为了加速运算，它们有如下的成员：
###### 缓存BigInt 
缓存一次运算值。
###### 相关值GameInt 
若有其他GameInt引用了该数值元，则其他的GameInt会存储和它相关的数值元。假若数值元自己发生了改变，则自己与所有相关值的脏位也会标记为脏。
###### 脏位
若脏位为True，则尝试读取该数值元时会重新运算一遍。
###### 基础值BigInt 
基本值。
###### 同级基础值GameNumSet 
###### 基乘数乘区GameNumSet 
###### 额外乘区GameNumSet
###### 额外值
###### Ceil / Floor

（基础值+同级基础值和）✕ （1+基乘数乘区只和）✕ 额外乘区之积 + 额外值

# 游戏数值
游戏数值由数值元组成，并且会自动统计如下的内容：
###### 基本数值 .val
基本数值即经典的独立数值。
###### 累计值 .logVal.(all/initName.all/initName.current)
游戏会自动统计基本数值的总获得、各Init的（总获得、当前游戏次数的总获得）。
###### 标签和 tagTemplate 下的内容
每个游戏数值都会存储tagSet。
对于拥有标签的游戏数值，它们会拥有一个惰性计算的基本数值和：例如 A,B,C tagged T 时，可以使用 T 聚合得到 基本数值和、累计值和等内容。

此外，游戏数值有分如下几类：
### 资源值：等待其他供给
资源值如 *钻石数量* *信用点数量* 等。
###### 增长值：提供资源值
资源值会拥有一个增长值。提供每秒的资源值。它们是GameNum的复杂关系构建者。
### 关系计算值：复杂运算的结果
关系计算值拥有一系列的关系设计。
### Flag值：是否取得与取得值和
例如是否获得某Template等等，只有1和0等等。

# 条件判断
## 原子条件
有如下几种简单的条件：
###### 值达到......过 
###### 值与定值关系......
可以使用是否拥有作为1和0的概念。
###### 某值与某值关系......

## 复合条件
可以使用原子条件的与-或关系构成复合关系，继续使用复合关系构成更复杂的关系等。
## 触发器型条件和惰性条件
触发器型条件会监视它需求的值，满足后立即发生行为。
惰性条件只有要求判断时才会进行一次判断。