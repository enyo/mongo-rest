MongoRest = require("../src/index")
_ = require("underscore")
describe "MongoRest", ->
  classConfig = { }
  resourceConfig = { }

  beforeEach ->

    classConfig =
      pathPrefix: "class-"
      pathSuffix: "class-"
      viewPrefix: "PREF"
      viewSuffix: "SUFF"
      viewDataNamePrefix: "DATAPREF"
      viewDataNameSuffix: "DATASUFF"
      camelizeJSONDataKeys: no
      JSONDataNamePrefix: "JSONDATAPREF"
      JSONDataNameSuffix: "JSONDATASUFF"
      enableXhr: true
      singleView: false

    resourceConfig =
      pathPrefix: "resource-"
      viewPrefix: "PREF_res"
      viewSuffix: "SUFF_res"
      viewDataNamePrefix: "DATAPREF_res"
      viewDataNameSuffix: "DATASUFF_res"
      camelizeJSONDataKeys: yes
      JSONDataNamePrefix: "JSONDATAPREF_res"
      JSONDataNameSuffix: "JSONDATASUFF_res"
      enableXhr: false
      singleView: true



  describe "constructor", ->
    it "should store the options", ->
      app = {}
      mongoRest = new MongoRest(app, null, true) # dont register routes
      mongoRest.options.should.eql
        urlRoot: "/"
        pathPrefix: ""
        pathSuffix: ""
        viewPrefix: "resource_"
        viewSuffix: ""
        viewDataNamePrefix: ""
        viewDataNameSuffix: ""
        camelizeJSONDataKeys: yes
        JSONDataNamePrefix: ""
        JSONDataNameSuffix: ""
        enableXhr: false
        singleView: true

      classConfig.urlRoot = "/someurl/"

      mongoRest = new MongoRest(app, classConfig, true) # dont register routes
      mongoRest.options.should.eql classConfig

    describe "routes", ->
      registered = undefined
      app =
        all: (address) -> registered.push ["all", address]

        get: (address) -> registered.push ["get", address]

        post: (address) -> registered.push ["post", address]

        put: (address) -> registered.push ["put", address]

        delete: (address) -> registered.push ["delete", address]

      it "should register routes if asked nicely", ->
        registered = []
        mongoRest = new MongoRest app, urlRoot: "/some/url/"
        registered.should.eql [
          ["all", "/some/url/:resourceName"],
          ["get", "/some/url/:resourceName"],
          ["post", "/some/url/:resourceName"],
          ["all", "/some/url/:resourceName/:id"],
          ["get", "/some/url/:resourceName/:id"],
          ["put", "/some/url/:resourceName/:id"],
          ["delete", "/some/url/:resourceName/:id"]
        ]

      it "shouldn't register routes if asked nicely", ->
        registered = [ ]
        mongoRest = new MongoRest(app, # Don't register routes.
          pathPrefix: "/some/url/"
        , true)
        registered.should.eql [ ]



  describe "addResource()", ->
    it "should return the addedResource", ->
      app = {}

      mongoRest = new MongoRest(app, null, true) # dont register routes
      resource = mongoRest.addResource new -> @modelName = "User"
      resource.should.equal mongoRest.resources[0]

    it "should create the view and dataNames automatically for singular and plural", ->
      app = {}
      model1 = new -> @modelName = "User"
      model2 = new -> @modelName = "MyHobby"

      mongoRest = new MongoRest(app, null, true) # dont register routes
      mongoRest.addResource model1
      mongoRest.addResource model2

      resource1 = mongoRest.resources[0]
      resource2 = mongoRest.resources[1]

      resource1.entityView.should.eql "resource_user"
      resource1.collectionView.should.eql "resource_users"
      resource1.entityViewDataName.should.eql "user"
      resource1.collectionViewDataName.should.eql "users"
      resource1.entityJSONDataName.should.eql "user"
      resource1.collectionJSONDataName.should.eql "users"

      resource2.entityView.should.eql "resource_my_hobby"
      resource2.collectionView.should.eql "resource_my_hobbies"
      resource2.entityViewDataName.should.eql "myHobby"
      resource2.collectionViewDataName.should.eql "myHobbies"
      resource2.entityJSONDataName.should.eql "myHobby"
      resource2.collectionJSONDataName.should.eql "myHobbies"

    it "should take the view names from the reource options if provided and not generate them", ->
      app = {}
      model1 = new -> @modelName = "MyHobby"

      mongoRest = new MongoRest(app, null, true) # dont register routes
      mongoRest.addResource model1, entityViewDataName: "view", collectionViewDataName: "views", entityJSONDataName: "JSON", collectionJSONDataName: "JSONs"

      resource1 = mongoRest.resources[0]

      resource1.entityView.should.eql "resource_my_hobby"
      resource1.collectionView.should.eql "resource_my_hobbies"
      resource1.entityViewDataName.should.eql "view"
      resource1.collectionViewDataName.should.eql "views"
      resource1.entityJSONDataName.should.eql "JSON"
      resource1.collectionJSONDataName.should.eql "JSONs"



    it "should take the class config and copy it onto the resource", ->
      app = {}
      model1 = new -> @modelName = "User"

      mongoRest = new MongoRest app, classConfig, true # dont register routes

      mongoRest.addResource model1

      mongoRest.resources[0][key].should.eql value for key, value of classConfig

    it "the resource config should overwrite the class config", ->
      app = {}
      model1 = new -> @modelName = "User"

      mongoRest = new MongoRest app, classConfig, true # dont register routes

      mongoRest.addResource model1, resourceConfig

      mongoRest.resources[0][key].should.eql value for key, value of resourceConfig


  describe "getResource()", ->
    it "should return the right resource for pathNames and models", ->
      app = {}

      model1 = new -> @modelName = "User"
      model2 = new -> @modelName = "Hobby"

      mongoRest = new MongoRest app, null, true # dont register routes

      mongoRest.addResource model1
      mongoRest.addResource model2

      userResource = mongoRest.resources[0]
      
      mongoRest.getResource("users").should.eql userResource
      mongoRest.getResource(model1).should.eql userResource

      hobbyResource = mongoRest.resources[1]
      
      mongoRest.getResource("hobbies").should.eql hobbyResource
      mongoRest.getResource(model2).should.eql hobbyResource


  describe "getPathName()", ->
    it "should return the dashed plural model name with the pathPrefix", ->
      app = {}
      mongoRest = new MongoRest app, { pathPrefix: "prefix/" }, true # dont register routes
      resource = mongoRest.addResource new -> @modelName = "MyHobby"
      mongoRest.getPathName(resource).should.equal "prefix/my-hobbies"


  describe "getCollectionUrl()", ->
    it "should return the correct url", ->
      app = {}
      mongoRest = new MongoRest app, urlRoot: "/resource/", true # dont register routes
      mongoRest.getCollectionUrl(pathName: "users").should.equal "/resource/users"


  describe "getEntityUrl()", ->
    it "should return the correct url", ->
      app = {}
      mongoRest = new MongoRest app, urlRoot: "/resource/", true # dont register routes

      mongoRest.getEntityUrl(
        pathName: "users"
        singleView: true
      ,
        _id: 123
      ).should.equal "/resource/users/123"

    it "should return the colleciton url if no single view in resource", ->
      app = {}
      mongoRest = new MongoRest(app, 
        urlRoot: "/resource/"
      , true)# dont register routes
      mongoRest.getEntityUrl(
        pathName: "users"
        singleView: false
      ,
        _id: 123
      ).should.equal "/resource/users"


  describe "redirect()", ->
    it "should redirect if not xhr", (done) ->
      app = {}
      req = resource:
        enableXhr: true

      res = redirect: (address) ->
        address.should.equal "test"
        done()

      next = ->

      mongoRest = new MongoRest(app, null, true) # dont register routes
      mongoRest.redirect "test", req, res, next

    it "should return a redirect string if xhr", (done) ->
      app = {}
      req =
        xhr: true
        resource:
          enableXhr: true

      res = send: (obj) ->
        obj.should.eql redirect: "test"
        done()

      next = ->

      mongoRest = new MongoRest(app, # dont register routes
        enableXhr: true
      , true)
      mongoRest.redirect "test", req, res, next

    it "should take the config from the resource not the class", (done) ->
      app = {}
      req =
        xhr: true
        resource:
          enableXhr: true

      res = send: (obj) ->
        obj.should.eql redirect: "test"
        done()

      next = ->

      
      # Now setting enableXhr to false here, but the resource config should be taken
      mongoRest = new MongoRest(app, # dont register routes
        enableXhr: false
      , true)
      mongoRest.redirect "test", req, res, next


  describe "flash()", ->
    it "should do nothing if xhr", ->
      app = {}
      req =
        xhr: true
        resource:
          enableXhr: true

        flash: ->
          true.should.be["false"]

      mongoRest = new MongoRest(app, # dont register routes
        enableXhr: true
      , true)
      mongoRest.flash "error", "hi", req
      mongoRest.flash "success", "hi2", req

    it "should forward to req.flash() directly if xhr is disabled on resource", (done) ->
      app = {}
      req =
        xhr: true
        resource:
          enableXhr: false

        flash: (type, msg) ->
          type.should.equal "error"
          msg.should.equal "some message"
          done()

      mongoRest = new MongoRest(app, # dont register routes
        enableXhr: false
      , true)
      mongoRest.flash "error", "some message", req


  describe "renderError()", ->
    it "should send the error without flash message if XHR", (done) ->
      app = {}
      res =
        send: (errCode, message) ->
          errCode.should.eql 404
          message.should.eql "Some error"

          done()
        status: -> 
      req =
        resource:
          enableXhr: true

        xhr: true

      next = ->

      
      # The enableXhr setting here should be ignored
      mongoRest = new MongoRest(app, # dont register routes
        enableXhr: false
      , true)
      mongoRest.flash "error", "test message", req
      mongoRest.renderError new Error("Some error"), req, res, next, 404, "some/url"

    it "should forward to next() if not XHR", (done) ->
      app = {}
      res =
        status: -> 

      flashed = []
      req =
        xhr: false
        resource:
          enableXhr: true

        flash: (type, msg) ->
          flashed.push [type, msg]

      next = (err) ->
        flashed.should.eql [["error", "test message"]]
        err.should.eql "Some error"
        done()

      
      # The enableXhr setting here should be ignored.
      mongoRest = new MongoRest(app, # dont register routes
        enableXhr: true
      , true)
      mongoRest.flash "error", "test message", req
      mongoRest.renderError "Some error", req, res, next


