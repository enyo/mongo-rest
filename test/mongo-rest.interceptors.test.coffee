MongoRest = require("../src/index")
_ = require("underscore")
req = new ->
  @req = true

res = new ->
  @res = true

next = ->
  next = true

describe "MongoRest interceptors", ->

  class userModel
    save: (callback) -> setTimeout (-> callback saveError), 1

  userModel.modelName = "User"
  userModel.lean = -> userModel
  userModel.find = -> userModel
  userModel.sort = (sort) ->
    userModelSortParam = sort
    userModel
  userModel.exec = (args...) -> exec args...


  class addressModel
    save: (callback) -> setTimeout (-> callback saveError), 1

  addressModel.modelName = "Address"
  addressModel.lean = -> addressModel
  addressModel.find = -> addressModel
  addressModel.sort = (sort) ->
    addressModelSortParam = sort
    addressModel
  addressModel.exec = (args...) -> exec args...




  describe "addInterceptor()", ->
    it "should throw an error if the resource is undefined", ->
      mongoRest = new MongoRest({}, null, true) # dont register routes
      (->
        mongoRest.addInterceptor userModel, "post", ->

      ).should.throw "The resource User is not defined!"

    it "should handle class with a string as event", ->
      mongoRest = new MongoRest { }, null, true # dont register routes
      mongoRest.addResource userModel, { }
      mongoRest.addResource addressModel, { }

      interceptor1 = new ->
        @inter1 = true

      interceptor2 = new ->
        @inter2 = true

      mongoRest.addInterceptor userModel, "post", interceptor1
      mongoRest.addInterceptor userModel, "post", interceptor2
      mongoRest.addInterceptor addressModel, "delete", interceptor2
      mongoRest.interceptors.should.eql
        User:
          post: [interceptor1, interceptor2]

        Address:
          delete: [interceptor2]


    it "should handle an array of events", ->
      mongoRest = new MongoRest({}, null, true) # dont register routes
      mongoRest.addResource userModel, {}
      mongoRest.addResource addressModel, {}
      interceptor1 = new ->
        @inter1 = true

      interceptor2 = new ->
        @inter2 = true

      mongoRest.addInterceptor userModel, ["post", "put", "delete"], interceptor1
      mongoRest.addInterceptor userModel, ["post", "delete"], interceptor2
      mongoRest.addInterceptor addressModel, ["put", "delete"], interceptor2
      mongoRest.interceptors.should.eql
        User:
          post: [interceptor1, interceptor2]
          put: [interceptor1]
          delete: [interceptor1, interceptor2]

        Address:
          put: [interceptor2]
          delete: [interceptor2]



  describe "invokeInterceptors()", ->
    mongoRest = undefined
    beforeEach ->
      mongoRest = new MongoRest({}, null, true) # dont register routes
      mongoRest.addResource userModel, {}

    it "should call callback directly if there is no interceptor", ->
      called = false
      mongoRest.invokeInterceptors userModel, "get",
        doc: {}
      , req, res, next, ->
        called = true

      called.should.be["true"]

    it "should call callback when interceptor finished synchronously", ->
      called = false
      mongoRest.addInterceptor userModel, "get", (info, done) ->
        done()

      mongoRest.invokeInterceptors userModel, "get",
        doc: {}
      , req, res, next, ->
        called = true

      called.should.be["true"]

    it "should call callback exactly once when multiple interceptors finish synchronously", ->
      called = 0
      mongoRest.addInterceptor userModel, "get", (info, done) ->
        done()

      mongoRest.addInterceptor userModel, "get", (info, done) ->
        done()

      mongoRest.addInterceptor userModel, "get", (info, done) ->
        done()

      mongoRest.invokeInterceptors userModel, "get",
        doc: {}
      , req, res, next, ->
        called++

      called.should.equal 1

    it "should call callback when interceptor finished asynchronously", (done) ->
      mongoRest.addInterceptor "users", "get", (info, done) ->
        setTimeout done, 1

      mongoRest.invokeInterceptors "users", "get",
        doc: {}
      , req, res, next, ->
        done()


    it "should call callback exactly once when multiple interceptors finish asynchronously", (done) ->
      mongoRest.addInterceptor userModel, "get", (info, done) ->
        setTimeout done, 1

      mongoRest.addInterceptor userModel, "get", (info, done) ->
        setTimeout done, 1

      mongoRest.addInterceptor userModel, "get", (info, done) ->
        setTimeout done, 1

      mongoRest.invokeInterceptors userModel, "get",
        doc: {}
      , req, res, next, ->
        done()


    it "should actually invoke the \"get\" interceptors with each doc when \"collection-get\" is invoked", (done) ->
      called = 0
      doc1 = new ->

      doc2 = new ->

      doc3 = new ->

      docs = [doc1, doc2, doc3]
      remainingDocs = [doc1, doc2, doc3]
      mongoRest.addInterceptor userModel, "get", (info, done) ->
        
        # Check if the doc actually exists.
        index = remainingDocs.indexOf(info.doc)
        index.should.not.equal -1
        
        # Delete it to make sure it's not called twice with the same doc.
        delete remainingDocs[index]

        called++
        setTimeout done, 1

      mongoRest.invokeInterceptors userModel, "get-collection",
        docs: docs
      , req, res, next, ->
        called.should.equal 3
        done()


    it "should stop invoking interceptors when one interceptor fails and forward the error to onFinish() synchronously", (done) ->
      called = 0
      err1 = new Error("err1")
      err2 = new Error("err2")
      err3 = new Error("err3")
      mongoRest.addInterceptor userModel, "get", (info, done) ->
        called++
        done err1

      mongoRest.addInterceptor userModel, "get", (info, done) ->
        called++
        done err2

      mongoRest.addInterceptor userModel, "get", (info, done) ->
        called++
        done err3

      mongoRest.invokeInterceptors userModel, "get",
        doc: {}
      , req, res, next, (err) ->
        err.should.equal err1
        called.should.equal 1
        done()


    it "should forward the error to onFinish() asynchronously", (done) ->
      called = 0
      err1 = new Error("err1")
      err2 = new Error("err2")
      err3 = new Error("err3")
      mongoRest.addInterceptor userModel, "get", (info, done) ->
        called++
        setTimeout (->
          done err1
        ), 10

      mongoRest.addInterceptor userModel, "get", (info, done) ->
        called++
        setTimeout (->
          done err2
        ), 10

      mongoRest.addInterceptor userModel, "get", (info, done) ->
        called++
        setTimeout (->
          done err3
        ), 1

      mongoRest.invokeInterceptors userModel, "get",
        doc: {}
      , req, res, next, (err) ->
        err.should.equal err3
        called.should.equal 3
        done()


    it "should stop invoking interceptors when one interceptor fails with get-collection as well", (done) ->
      called = 0
      err1 = new Error("err1")
      err2 = new Error("err2")
      err3 = new Error("err3")
      
      # this interceptor calls `done` with an error only if the document contains `a`. Which means
      # that it will be called 3 times.
      mongoRest.addInterceptor userModel, "get", (info, done) ->
        called++
        done (if info.doc.a then err1 else null)

      mongoRest.addInterceptor userModel, "get", (info, done) ->
        called++
        done err2

      mongoRest.addInterceptor userModel, "get", (info, done) ->
        called++
        done err3

      mongoRest.invokeInterceptors userModel, "get-collection",
        docs: [{}, {},
          a: 1
        ]
      , req, res, next, (err) ->
        err.should.equal err1
        called.should.equal 3
        done()



