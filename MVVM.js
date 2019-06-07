// 观察者 （发布订阅） 被观察者

class Dep{
  constructor(){
    this.subs = []  // 存放所有数组
    }
  // 订阅
  addSub(watcher){  // 添加watcher
    this.subs.push(watcher)
  }

  // 发布
  notify(){
    this.subs.forEach(watcher=>watcher.update())
  }
}

class Watcher{  // 监听改变然后重新编译
  constructor(vm, expr, cb){
    this.vm = vm
    this.expr = expr
    this.cb = cb
    // 默认先存放一个老值
    this.oldValue= this.get()
  }
  get(){
    // 先把自己放在this上
    Dep.target = this
    // 取值 把这个观察者和数据关联起来
    let value = CompileUtil.getValue(this.vm, this.expr)
    Dep.target = null
    return value
  }
  update(){  // 更新操作 数据变化后 会调用观察者的update方法
    let newVal = CompileUtil.getValue(this.vm, this.expr)
    if(newVal !== this.oldValue) {
      this.cb(newVal)
    }
  }
}


// vm.$watch(vm, 'student.name', (newVal)=>{
//
// })

// 实现数据劫持
class Observer{
  constructor(data){
    // 要把对象依次遍历
    this.observer(data)
  }

  observer(data) {
    // 对象才观察
    if(data && typeof data == 'object'){
      for (let key in data) {
        this.defineReact(data, key, data[key])
      }
    }
  }

  defineReact(obj, key, value) {
    this.observer(value)
    let dep = new Dep()  //给每个属性 都加上一个具有发布订阅的功能
    Object.defineProperty(obj, key, {
      get(){
        //创建watcher时会取到对应的方法 并且把watcher放到了全局上
        Dep.target && dep.addSub(Dep.target)
        return value
      },
      set: (newVal) => {
        if(newVal != value){
          this.observer(newVal)
          value = newVal
          dep.notify()
        }
      }
    })
  }
}

// 基类  调度
class Compiler {
  constructor(el, vm){
    // 判断el是不是元素  不是就获取
    this.el = this.isElementNode(el) ? el : document.querySelector(el)
    this.vm = vm
    // 把当前节点中的元素获取到 放入内存
    let fragment = this.node2fragment(this.el)
    // 把节点的内容进行替换

    // 编译(文档碎片)模板 用数据编译
    this.compile(fragment)

    // 把页面再转回页面中
    this.el.appendChild(fragment)
  }

  // 判断它是不是指令
  isDirective(attrName) {
    return attrName.startsWith('v-')
  }

  // 编译元素
  compileElement(node) {
    let attributes = node.attributes;   // 类数组
    [...attributes].forEach((attr)=>{  // name=value形式
      let {name, value:expr} = attr
      if(this.isDirective(name)){
        let [,directive] = name.split('-')  // v-model,v-html, v-bind, v-on:click....
        // 需要调用不同的指令来处理
        let [directiveName, eventName] = directive.split(':')
        CompileUtil[directiveName](node, expr, this.vm, eventName)  // 从vm(实例)中取表达式放到元素上面
      }
    })
  }
  // 编译文本
  compileText(node) {  //判断当前文本节点中是否包含{{}}
    let content = node.textContent;
    // 不加问号  就从一个大括号一直匹配到最后一个
    if(/\{\{(.+?)\}\}/g.test(content)){
      // console.log(content, 'text')  // 找到所有文本,赋值给node
      CompileUtil['text'](node, content, this.vm)
    }
  }
  // 编译内存中的dom节点
  compile(node) {
    let childNodes = node.childNodes;
    [...childNodes].forEach((child)=>{
      // console.log(child)
      if(this.isElementNode(child)){
        // 如果是元素,要再遍历子节点
        this.compileElement(child)
        this.compile(child)
      }else{
          this.compileText(child)
      }
    })
  }

  // 把节点移动到内存中
  node2fragment(node) {
    // 创建一个文档碎片
    let fragment = document.createDocumentFragment()
    let firstChild;
    while(firstChild = node.firstChild){
      // appendChild具有移动性 拿到一个原来就少一个
      fragment.appendChild(firstChild)
    }
    return fragment
  }

  isElementNode(node) { // 是不是元素节点
    return node.nodeType === 1
  }

}

CompileUtil = {
  getValue(vm, expr){ // vm.$data  student.name  分开取值
    // reduce 叠加
    let arr = expr.split('.')
    if(arr.length === 1){
      return vm.$data[expr]
    }
    return expr.split('.').reduce((data, current)=>{
      return data[current]
    }, vm.$data)

  },
  setValue: function (vm, expr, value) {  // vm.$data  student.name 赋值
    return expr.split('.').reduce((data, current, index, arr)=>{
      // 取到.的最后一项就赋值
      if(index == arr.length-1){
        return data[current] = value
      }
      return data[current]
    }, vm.$data)

  },
  // 解析v-model事件
  model(node, expr, vm){  // 节点 表达式 当前实例
    //student.name 对应 vm.$data
    let fn = this.updater['modelUpdater']
    new Watcher(vm, expr, (newVal)=>{
      // 给输入框加一个观察者 若后面数据更新了就会出发此方法 会拿新值填充输入框
      fn(node, newVal)
    })
    node.addEventListener('input', (e)=>{
      let value = e.target.value  // 获取用户输入的值
      this.setValue(vm, expr, value)
    })
    let value = this.getValue(vm, expr) // 这块就拿到那个名字了
    fn(node, value)
  },
  html(node, expr, vm){  //
    let fn = this.updater['htmlUpdater']
    new Watcher(vm, expr, (newVal)=>{
      // 给输入框加一个观察者 若后面数据更新了就会出发此方法 会拿新值填充输入框
      fn(node, newVal)
    })
    let value = this.getValue(vm, expr) // 这块就拿到那个名字了
    fn(node, value)
  },
  getContentValue(vm, expr){
    // 遍历表达式 将内容融信替换成一个完整的内容返还回去
    return expr.replace(/\{\{(.+?)\}\}/g,(...args)=>{
      return this.getValue(vm, args[1])
    })
  },
  on(node, expr, vm, eventName){  // expr=change v-on:click="change"
    node.addEventListener(eventName, (e)=>{
      vm[expr].call(vm, e)
    })
  },
  text(node, expr, vm){
    let fn = this.updater['textUpdater']
    // 全局匹配 {{a}}相当于把这个替换为data里面的数据
    let content = expr.replace(/\{\{(.+?)\}\}/g,(...args)=>{
      // console.log(this.getValue(vm, args[1]))  // 这里拿到了
      // 给表达式每个人{{}}都加上观察者
      new Watcher(vm, args[1], ()=>{
        // 因为不止一个值，，要拿到所有的 再更新
        fn(node,this.getContentValue(vm, expr))
      })
      return this.getValue(vm, args[1])
    })
    fn(node, content)
  },
  updater: {
    // 把数据插入到节点中
    modelUpdater(node,value){
      node.value = value
    },
    htmlUpdater(node, value){ // innerHTML不安全 不要乱搞
      node.innerHTML = value
    },
    // 处理文本节点
    textUpdater(node, value) {
      node.textContent = value
    }
  }
}

class Vue {
  constructor(options){
    // this.$el $data...
    this.$el = options.el
    this.$data = options.data
    let computed = options.computed
    let methods = options.methods
    // 这个根元素存在,编译模板
    if(this.$el){

      // 把数据全部转换成Object.objectProperty定义的
      new Observer(this.$data)


      // 把vm上的数据操作都代理到vm.$data上
      this.proxyVm(this.$data)
      // {{getNewName}} reduce vm.$data.getNewName
      for(let key in computed){  // 会根据依赖的数据替代watcher
          Object.defineProperty(this.$data, key,{
            get:()=>{
              return computed[key].call(this)
          }
        })
      }
      for(let key in methods){
        Object.defineProperty(this, key, {
          get(){
            return methods[key]
          }
        })
      }
      console.log(this.$data)
      new Compiler(this.$el, this)
    }
  }

  // vm.student = vm.$data.student
  proxyVm(data) {
    for (let key in data){
      // 在实例上的取值全部转到data里面去取
      Object.defineProperty(this, key, {
        get(){
          return data[key]   // 转化操作
        },
        set(newValue){  // 代理的set方法  本来vm.$data.XXX可以改值，现在vm.XXX就可以改
          data[key] = newValue
        }
      })
    }
  }
}
