MongoRest = require("../src/index")
_ = require("underscore")

describe "MongoRest", ->
  app = { }

  exec = ->
  userModelSortParam = null
  saveError = null

  class userModel
    save: (callback) -> setTimeout (-> callback saveError), 1

  userModel.modelName = "User"
  userModel.find = -> userModel
  userModel.sort = (sort) ->
    userModelSortParam = sort
    userModel
  userModel.exec = (args...) -> exec args...



  afterEach ->
    exec = ->
    saveError = null
    userModelSortParam = null



  describe "renderCollection()", ->
    it "should render a collection correctly depending on the request", ->
      sentDocs = undefined
      renderedView = undefined
      renderedInfo = undefined
      mongoRest = undefined
      req =
        xhr: true
        resource:
          enableXhr: true
          model: {}
          entityView: "user_view"
          collectionView: "users_view"
          entityJSONDataName: "JSONdoc"
          collectionJSONDataName: "JSONdocs"
          entityViewDataName: "VIEWdoc"
          collectionViewDataName: "VIEWdocs"

        params:
          resourceName: "user"

      res =
        send: (docs) -> sentDocs = docs
        render: (view, info) ->
          renderedView = view
          renderedInfo = info

      next = ->

      doc1 =
        doc1: true
        toObject: -> a: "value1"

      doc2 =
        doc2: true
        toObject: -> b: "value2"

      docs = [doc1, doc2]
      
      # enableXhr is false by default.
      sentDocs = renderedView = renderedInfo = null
      req.resource.enableXhr = false
      mongoRest = new MongoRest app, {}, true # Don't register routes

      mongoRest.renderCollection docs, req, res, next
      (sentDocs is null).should.be["true"]
      renderedView.should.eql "users_view"

      renderedInfo.should.eql
        VIEWdocs: [
          { a: "value1" }
          { b: "value2" }
        ]
        site: "user-list"

      
      # Set enableXhr to true
      sentDocs = renderedView = renderedInfo = null
      req.tmpFlashs = [
        type: "error"
        msg: "hi"
      ]

      req.resource.enableXhr = true
      mongoRest = new MongoRest app, { }, true
      mongoRest.renderCollection docs, req, res, next
      sentDocs.should.eql JSONdocs: [
        { a: "value1" }
        { b: "value2" }
      ]
      (renderedView is null).should.be["true"]
      (renderedInfo is null).should.be["true"]
      
      # Set enableXhr to true but the request is not xhr.
      sentDocs = renderedView = renderedInfo = null
      req.xhr = false

      mongoRest = new MongoRest app, { }, true # Don't register routes

      mongoRest.renderCollection docs, req, res, next

      (sentDocs is null).should.be["true"]
      renderedView.should.eql "users_view"
      renderedInfo.should.eql
        VIEWdocs: [
          { a: "value1" }
          { b: "value2" }
        ]
        site: "user-list"



  describe "collectionGet()", ->
    mongoRest = new MongoRest({}, null, true) # Don't register routes
    doc1 = new ->
      @doc1 = true

    doc2 = new ->
      @doc2 = true

    initialDocs = [doc1, doc2]
    beforeEach ->
      exec = (callback) ->
        callback null, initialDocs

    req =
      resource:
        model: userModel
        sort: "-name"

      params:
        resourceName: "user"

    mongoRest.addResource userModel
    # req.userModel = userModel

    it "should directly render if there are no interceptors", (done) ->
      mongoRest.renderCollection = (docs) ->
        userModelSortParam.should.eql "-name"
        docs.should.eql initialDocs
        done()

      mongoRest.collectionGet() req, {}, {}

    it "should call all 'get' interceptors and render the entity asynchroniously", (done) ->
      interceptedCount = 0
      interceptor = (info, iDone) ->
        info.doc.should.equal initialDocs[interceptedCount % 2]
        interceptedCount++
        setTimeout (->
          iDone()
        ), 1

      mongoRest.renderCollection = (docs) ->
        interceptedCount.should.equal 6 # Each interceptor for each document.
        docs.should.eql initialDocs
        done()

      # req.model = userModel
      mongoRest.addInterceptor userModel, "get", interceptor
      mongoRest.addInterceptor userModel, "get", interceptor
      mongoRest.addInterceptor userModel, "get", interceptor
      mongoRest.collectionGet() req, {}, {}

    it "should call all 'get' interceptors and render the entity synchroniously", (done) ->
      interceptedCount = 0
      interceptor = (info, iDone) ->
        info.doc.should.equal initialDocs[interceptedCount % 2]
        interceptedCount++
        iDone()

      mongoRest.renderCollection = (docs) ->
        interceptedCount.should.equal 6 # Each interceptor for each document.
        docs.should.eql initialDocs
        done()

      # req.model = userModel
      mongoRest.addInterceptor userModel, "get", interceptor
      mongoRest.addInterceptor userModel, "get", interceptor
      mongoRest.addInterceptor userModel, "get", interceptor
      mongoRest.collectionGet() req, {}, {}


  describe "collectionPost()", ->
    mongoRest = new MongoRest({}, null, true) # Don't register routes
    emptyDoc = save: (callback) ->
      setTimeout callback, 1

    req =
      body:
        user:
          some: "values"

      resource:
        model: userModel
        pathName: "users"
        sort: "-name"
        entityJSONDataName: "user"

      params:
        resourceName: "users"

      flash: ->

    beforeEach ->
      mongoRest = new MongoRest({}, null, true) # Don't register routes
      mongoRest.addResource userModel

    it "should call the 'post' and 'post.success' event interceptors on success", (done) ->
      interceptorList = []
      interceptor = (intName) ->
        (info, iDone) ->
          interceptorList.push intName
          setTimeout iDone, 1

      mongoRest.addInterceptor userModel, "post", interceptor("firstPost")
      mongoRest.addInterceptor userModel, "post", interceptor("secondPost")
      mongoRest.addInterceptor userModel, "post.success", interceptor("post.success")
      mongoRest.addInterceptor userModel, "post.error", interceptor("post.error")
      res = redirect: (address) ->
        address.should.equal "/users"
        interceptorList.should.eql ["firstPost", "secondPost", "post.success"]
        done()

      mongoRest.collectionPost() req, res, {}

    it "should call the 'post.error' event interceptors on error", (done) ->
      mongoRest.flash = (type, message) ->
        true.should.be["false"]

      saveError = new Error("Some Error")

      interceptorList = []
      interceptor = (intName) ->
        (info, iDone) ->
          interceptorList.push intName
          setTimeout iDone, 1

      mongoRest.addInterceptor userModel, "post", interceptor("firstPost")
      mongoRest.addInterceptor userModel, "post", interceptor("secondPost")
      mongoRest.addInterceptor userModel, "post.success", interceptor("post.success")
      mongoRest.addInterceptor userModel, "post.error", interceptor("post.error")
      mongoRest.renderError = (err, req, res, next, errCode, address) ->
        err.message.should.equal "Unable to insert the record: Some Error"
        address.should.equal "/users"
        interceptorList.should.eql ["firstPost", "secondPost", "post.error"]
        done()

      mongoRest.collectionPost() req, {}, {}

    it "should call the 'post.error' event interceptors if the 'post' interceptor errors", (done) ->
      mongoRest.flash = (type, message) ->
        true.should.be["false"]


      interceptorList = []
      interceptor = (intName) ->
        (info, iDone) ->
          interceptorList.push intName
          setTimeout iDone, 1

      mongoRest.addInterceptor userModel, "post", interceptor("firstPost")
      mongoRest.addInterceptor userModel, "post", (info, iDone) ->
        iDone new Error("interceptor error")

      mongoRest.addInterceptor userModel, "post", interceptor("secondPost")
      mongoRest.addInterceptor userModel, "post.success", interceptor("post.success")
      mongoRest.addInterceptor userModel, "post.error", interceptor("post.error")
      mongoRest.renderError = (err, req, res, next, errCode, address) ->
        err.message.should.equal "Unable to insert the record: interceptor error"
        address.should.equal "/users"
        interceptorList.should.eql ["firstPost", "post.error"]
        done()

      mongoRest.collectionPost() req, {}, {}

    it "should call the 'post.error' event interceptors if the post.success interceptor errors", (done) ->
      mongoRest.flash = (type, message) ->
        true.should.be["false"]

      interceptorList = []
      interceptor = (intName) ->
        (info, iDone) ->
          interceptorList.push intName
          setTimeout iDone, 1

      mongoRest.addInterceptor userModel, "post", interceptor("firstPost")
      mongoRest.addInterceptor userModel, "post", interceptor("secondPost")
      mongoRest.addInterceptor userModel, "post.success", interceptor("post.success")
      mongoRest.addInterceptor userModel, "post.error", interceptor("post.error")
      mongoRest.addInterceptor userModel, "post.success", (info, iDone) ->
        iDone new Error("interceptor error")

      mongoRest.renderError = (err, req, res, next, errCode, address) ->
        err.message.should.equal "Unable to insert the record: interceptor error"
        address.should.equal "/users"
        interceptorList.should.eql ["firstPost", "secondPost", "post.success", "post.error"]
        done()

      mongoRest.collectionPost() req, {}, {}


