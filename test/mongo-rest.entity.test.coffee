
MongoRest = require("../src/index")
_ = require("underscore")


describe "MongoRest", ->

  class userModel
    save: (callback) -> setTimeout (-> callback saveError), 1

  userModel.modelName = "User"
  userModel.lean = -> userModel
  userModel.find = -> userModel
  userModel.sort = (sort) ->
    userModelSortParam = sort
    userModel
  userModel.exec = (args...) -> exec args...


  doc1 =
    doc1: true
    toObject: -> a: "value1"

  doc2 =
    doc2: true
    toObject: -> b: "value2"




  describe "entity()", ->
    it "should send a 404 if the entity is not found"


  describe "renderEntity()", ->
    it "should render an entity correctly depending on the request", ->
      sentDoc = undefined
      renderedView = undefined
      renderedInfo = undefined
      mongoRest = undefined
      req =
        xhr: true
        resource:
          model: { }

          enableXhr: false

          entityView: "user_view"
          collectionView: "users_view"
          entityJSONDataName: "JSONdoc"
          collectionJSONDataName: "JSONdocs"
          entityViewDataName: "VIEWdoc"
          collectionViewDataName: "VIEWdocs"

        params:
          resourceName: "user"

      res =
        send: (doc) ->
          sentDoc = doc

        render: (view, info) ->
          renderedView = view
          renderedInfo = info

      next = ->

      
      # enableXhr is false by default.
      sentDoc = renderedView = renderedInfo = null
      req.resource.enableXhr = false

      mongoRest = new MongoRest { }, { }, true

      mongoRest.renderEntity doc1, req, res, next
      (sentDoc is null).should.be["true"]
      renderedView.should.eql "user_view"
      renderedInfo.should.eql
        VIEWdoc: a: "value1"
        site: "user-show"

      
      # Set enableXhr to true
      sentDoc = renderedView = renderedInfo = null
      req.resource.enableXhr = true
      mongoRest = new MongoRest {}, {}, true # Don't register routes
      mongoRest.renderEntity doc1, req, res, next
      sentDoc.should.eql JSONdoc: a: "value1"
      (renderedView is null).should.be["true"]
      (renderedInfo is null).should.be["true"]
      
      # Set enableXhr to true but the request is not xhr.
      sentDoc = renderedView = renderedInfo = null
      mongoRest = new MongoRest { }, { }, true
      req.xhr = false
      mongoRest.renderEntity doc1, req, res, next
      (sentDoc is null).should.be["true"]
      renderedView.should.eql "user_view"
      renderedInfo.should.eql
        VIEWdoc: a: "value1"
        site: "user-show"



  describe "entityGet()", ->
    mongoRest = new MongoRest({}, null, true) # Don't register routes
    req =
      resource:
        model: userModel

      doc: new ->
        @doc = true

      params:
        resourceName: "user"

    mongoRest.addResource userModel, {}

    it "should directly render if there are no interceptors", (done) ->
      mongoRest.renderEntity = (doc) ->
        doc.should.equal req.doc
        done()

      route = mongoRest.entityGet()
      route req, {}, {}

    it "should call all interceptors and render the entity asynchroniously", (done) ->
      interceptedCount = 0
      interceptor = (info, iDone) ->
        interceptedCount++
        info.doc.should.equal req.doc
        setTimeout (->
          iDone()
        ), 1

      mongoRest.addInterceptor userModel, "get", interceptor
      mongoRest.addInterceptor userModel, "get", interceptor
      mongoRest.addInterceptor userModel, "get", interceptor
      route = mongoRest.entityGet()
      mongoRest.renderEntity = (doc) ->
        interceptedCount.should.equal 3
        doc.should.equal req.doc
        done()

      route req, {}, {}

    it "should call all interceptors and render the entity synchroniously", (done) ->
      interceptedCount = 0
      interceptor = (info, iDone) ->
        interceptedCount++
        info.doc.should.equal req.doc
        iDone()

      mongoRest.addInterceptor userModel, "get", interceptor
      mongoRest.addInterceptor userModel, "get", interceptor
      mongoRest.addInterceptor userModel, "get", interceptor
      route = mongoRest.entityGet()
      mongoRest.renderEntity = (doc) ->
        interceptedCount.should.equal 3
        doc.should.equal req.doc
        done()

      route req, {}, {}


  describe "modification functions", ->
    mongoRest = undefined
    error = undefined
    req =
      body:
        user:
          some: "values"

      doc:
        _id: 12345
        save: (callback) ->
          setTimeout (->
            callback error
          ), 1

        set: (data) ->

        remove: (callback) ->
          setTimeout (->
            callback error
          ), 1

      resource:
        model: userModel
        entityJSONDataName: "user"
        singleView: yes
        pathName: "users"


        # entityViewTemplate: "bla"
        # collectionViewTemplate: "bla"
        # singleView: true
        # entityDataName: "doc"
        # collectionDataName: "docs"

      params:
        resourceName: "users"

    beforeEach ->
      mongoRest = new MongoRest { }, null, true # Don't register routes
      mongoRest.addResource userModel, {}

    describe "entityPut()", ->
      it "should call the 'put' and 'put.success' event interceptors on success", (done) ->
        error = null
        flashs = []
        mongoRest.flash = (type, message) ->
          flashs.push [type, message]

        interceptorList = []
        interceptor = (intName) ->
          (info, iDone) ->
            interceptorList.push intName
            setTimeout iDone, 1

        mongoRest.addInterceptor userModel, "put", interceptor("firstPut")
        mongoRest.addInterceptor userModel, "put", interceptor("secondPut")
        mongoRest.addInterceptor userModel, "put.success", interceptor("put.success")
        mongoRest.addInterceptor userModel, "put.error", interceptor("put.error")
        res = redirect: (address) ->
          address.should.equal "/users/12345"
          flashs.should.eql [["success", "Successfully updated the record."]]
          interceptorList.should.eql ["firstPut", "secondPut", "put.success"]
          done()

        mongoRest.entityPut() req, res, {}

      it "should call the 'put.error' event interceptors on error", (done) ->
        error = new Error("Something went wrong1")
        mongoRest.flash = (type, message) -> # Should not happen.
          false.should.be["true"]

        interceptorList = []
        interceptor = (intName) ->
          (info, iDone) ->
            interceptorList.push intName
            setTimeout iDone, 1

        mongoRest.addInterceptor userModel, "put", interceptor("firstPut")
        mongoRest.addInterceptor userModel, "put", interceptor("secondPut")
        mongoRest.addInterceptor userModel, "put.success", interceptor("put.success")
        mongoRest.addInterceptor userModel, "put.error", interceptor("put.error")
        mongoRest.renderError = (err, req, res, next, errCode, address) ->
          err.message.should.equal "Unable to save the record: Something went wrong1"
          address.should.equal "/users/12345"
          interceptorList.should.eql ["firstPut", "secondPut", "put.error"]
          done()

        mongoRest.entityPut() req, {}, {}

      it "should call the 'put.error' event interceptors if the 'put' interceptor errors", (done) ->
        error = null
        mongoRest.flash = (type, message) -> # Should not happen.
          false.should.be["true"]

        interceptorList = []
        interceptor = (intName) ->
          (info, iDone) ->
            interceptorList.push intName
            setTimeout iDone, 1

        mongoRest.addInterceptor userModel, "put", interceptor("firstPut")
        mongoRest.addInterceptor userModel, "put", (info, iDone) ->
          iDone new Error("interceptor error")

        mongoRest.addInterceptor userModel, "put", interceptor("secondPut")
        mongoRest.addInterceptor userModel, "put.success", interceptor("put.success")
        mongoRest.addInterceptor userModel, "put.error", interceptor("put.error")
        mongoRest.renderError = (err, req, res, next, errCode, address) ->
          err.message.should.equal "Unable to save the record: interceptor error"
          address.should.equal "/users/12345"
          interceptorList.should.eql ["firstPut", "put.error"]
          done()

        mongoRest.entityPut() req, {}, {}

      it "should call the 'put.error' event interceptors if the put.success interceptor errors", (done) ->
        error = null
        mongoRest.flash = (type, message) -> # Should not happen.
          false.should.be["true"]

        interceptorList = []
        interceptor = (intName) ->
          (info, iDone) ->
            interceptorList.push intName
            setTimeout iDone, 1

        mongoRest.addInterceptor userModel, "put", interceptor("firstPut")
        mongoRest.addInterceptor userModel, "put", interceptor("secondPut")
        mongoRest.addInterceptor userModel, "put.success", interceptor("put.success")
        mongoRest.addInterceptor userModel, "put.error", interceptor("put.error")
        mongoRest.addInterceptor userModel, "put.success", (info, iDone) ->
          iDone new Error("interceptor error")

        mongoRest.renderError = (err, req, res, next, errCode, address) ->
          err.message.should.equal "Unable to save the record: interceptor error"
          address.should.equal "/users/12345"
          interceptorList.should.eql ["firstPut", "secondPut", "put.success", "put.error"]
          done()

        mongoRest.entityPut() req, {}, {}


    describe "entityDelete()", ->
      it "should call the 'delete' and 'delete.success' event interceptors on success", (done) ->
        error = null
        flashs = []
        mongoRest.flash = (type, message) ->
          flashs.push [type, message]

        interceptorList = []
        interceptor = (intName) ->
          (info, iDone) ->
            interceptorList.push intName
            setTimeout iDone, 1

        mongoRest.addInterceptor userModel, "delete", interceptor("firstPut")
        mongoRest.addInterceptor userModel, "delete", interceptor("secondDelete")
        mongoRest.addInterceptor userModel, "delete.success", interceptor("delete.success")
        mongoRest.addInterceptor userModel, "delete.error", interceptor("delete.error")
        res = redirect: (address) ->
          address.should.equal "/users"
          flashs.should.eql [["success", "Successfully deleted the record."]]
          interceptorList.should.eql ["firstPut", "secondDelete", "delete.success"]
          done()

        mongoRest.entityDelete() req, res, {}

      it "should call the 'delete.error' event interceptors on error", (done) ->
        error = new Error("Something went wrong2")
        mongoRest.flash = (type, message) ->
          true.should.be["false"]

        interceptorList = []
        interceptor = (intName) ->
          (info, iDone) ->
            interceptorList.push intName
            setTimeout iDone, 1

        mongoRest.addInterceptor userModel, "delete", interceptor("firstDelete")
        mongoRest.addInterceptor userModel, "delete", interceptor("secondDelete")
        mongoRest.addInterceptor userModel, "delete.success", interceptor("delete.success")
        mongoRest.addInterceptor userModel, "delete.error", interceptor("delete.error")
        mongoRest.renderError = (err, req, res, next, errCode, address) ->
          err.message.should.equal "Unable to delete the record: Something went wrong2"
          address.should.equal "/users"
          interceptorList.should.eql ["firstDelete", "secondDelete", "delete.error"]
          done()

        mongoRest.entityDelete() req, {}, {}

      it "should call the 'delete.error' event interceptors if the 'delete' interceptors error", (done) ->
        error = null
        mongoRest.flash = (type, message) ->
          true.should.be["false"]

        interceptorList = []
        interceptor = (intName) ->
          (info, iDone) ->
            interceptorList.push intName
            setTimeout iDone, 1

        mongoRest.addInterceptor userModel, "delete", interceptor("firstDelete")
        mongoRest.addInterceptor userModel, "delete", (info, iDone) ->
          iDone new Error("interceptor error")

        mongoRest.addInterceptor userModel, "delete", interceptor("secondDelete")
        mongoRest.addInterceptor userModel, "delete.success", interceptor("delete.success")
        mongoRest.addInterceptor userModel, "delete.error", interceptor("delete.error")
        mongoRest.renderError = (err, req, res, next, errCode, address) ->
          err.message.should.equal "Unable to delete the record: interceptor error"
          address.should.equal "/users"
          interceptorList.should.eql ["firstDelete", "delete.error"]
          done()

        mongoRest.entityDelete() req, {}, {}

      it "should call the 'delete.error' event interceptors if the 'delete.success' interceptors error", (done) ->
        error = null
        mongoRest.flash = (type, message) ->
          true.should.be["false"]

        interceptorList = []
        interceptor = (intName) ->
          (info, iDone) ->
            interceptorList.push intName
            setTimeout iDone, 1

        mongoRest.addInterceptor userModel, "delete", interceptor("firstDelete")
        mongoRest.addInterceptor userModel, "delete", interceptor("secondDelete")
        mongoRest.addInterceptor userModel, "delete.success", interceptor("delete.success")
        mongoRest.addInterceptor userModel, "delete.success", (info, iDone) ->
          iDone new Error("interceptor error")

        mongoRest.addInterceptor userModel, "delete.error", interceptor("delete.error")
        mongoRest.renderError = (err, req, res, next, errCode, address) ->
          err.message.should.equal "Unable to delete the record: interceptor error"
          address.should.equal "/users"
          interceptorList.should.eql ["firstDelete", "secondDelete", "delete.success", "delete.error"]
          done()

        mongoRest.entityDelete() req, {}, {}



