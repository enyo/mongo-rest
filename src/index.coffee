# REST Api
# Copyright(c) 2012 Matias Meno


# Module dependencies.
_ = require "underscore"
inflection = require "inflection"


# The models for which there will be a rest interface
# 
# `options` can have following values:
# 
# - `pathPrefix` The path prefix for the rest resources. Default to `/`
# - `entityView` The template that will be used as view name to render entity resources. `{{singularName}}` and `{{pluralName}}` can be used and will be substituted
# - `collectionView` The template that will be used as view name to render collection resources. `{{singularName}}` and `{{pluralName}}` can be used and will be substituted
# - `enableXhr` Enables a JSON interface for XMLHttpRequests. **Make sure you don't leak important information!**
# - `singleView` Whether there is a single view or not. If not, only the collection view will be used.

class MongoRest

  defaultOptions:
    # The URL root
    urlRoot: "/"

    # The path prefix for the rest resources.
    pathPrefix: ""

    # The path prefix for the rest resources.
    pathSuffix: ""

    # Will be prepended to the template name
    viewPrefix: "resource_"

    # Will be appended to the template name
    viewSuffix: ""

    # Will be prepended to the data index
    viewDataNamePrefix: ""

    # Will be appended to the data index
    viewDataNameSuffix: ""

    # Goes through the *whole* (even the data name) JSON array and converts the
    # keys to camelized if yes.
    # Otherwise the keys are underscored.
    camelizeJSONDataKeys: yes

    # Will be prepended to the data index
    JSONDataNamePrefix: ""

    # Will be appended to the data index
    JSONDataNameSuffix: ""

    # Enables a JSON interface for XMLHttpRequests. **Make sure you don't leak
    # important information!**
    enableXhr: false
    # Whether there is a single view or not. If not, only the collection view
    # will be used.
    singleView: true


  # @param {Object} app The express app object to register the routes to.
  # @param {Object} options Options for this MongoRest instance
  # @param {Boolean} dontRegisterRoutes If you want to setup the routes manually
  constructor: (@app, options, dontRegisterRoutes) ->
    @options = { }
    for own key, value of @defaultOptions
      @options[key] = options?[key] ? value
    
    # The resources for which there will be a rest interface
    @resources = []
    
    # Interceptors for specific events.
    @interceptors = {}
    @registerRoutes()  unless dontRegisterRoutes


  # Registers all REST routes with the provided `app` object.
  registerRoutes: ->
    
    # Accessing multiple resources
    
    # This makes sure the resource actually exists and prepares the model for the `get` and `post` actions.
    @app.all @options.urlRoot + ":resourceName", @collection()
    @app.get @options.urlRoot + ":resourceName", @collectionGet()
    @app.post @options.urlRoot + ":resourceName", @collectionPost()
    
    # Accessing single entities
    
    # This makes sure the resource exists, and loads the model for the `get`, `put` and `delete` actions.
    @app.all @options.urlRoot + ":resourceName/:id", @entity()
    @app.get @options.urlRoot + ":resourceName/:id", @entityGet()
    @app.put @options.urlRoot + ":resourceName/:id", @entityPut()
    @app["delete"] @options.urlRoot + ":resourceName/:id", @entityDelete()


  # Returns the dashed plural version of the model by default.
  # You can overwrite this function if you want another behaviour.
  getPathName: (resource) ->
    model = resource.model
    (@options.pathPrefix ? "") + (inflection.underscore inflection.pluralize model.modelName).toLowerCase().replace("_", "-") + (@options.pathSuffix ? "")

  # Returns the view for given model.
  getView: (resource, collection = no) ->
    model = resource.model
    view =  if collection then inflection.pluralize model.modelName else model.modelName
    view = inflection.underscore(view).toLowerCase()
    @options.viewPrefix + view + @options.viewSuffix

  # Returns the data name for given model to be used in the views model
  getViewDataName: (resource, collection = no) ->
    model = resource.model
    dataName =  if collection then inflection.pluralize model.modelName else model.modelName
    dataName = dataName.charAt(0).toLowerCase() + dataName.slice(1);
    @options.viewDataNamePrefix + dataName + @options.viewDataNameSuffix

  # Returns the data name for given model to be used in JSON
  getJSONDataName: (resource, collection = no) ->
    model = resource.model
    dataName =  if collection then inflection.pluralize model.modelName else model.modelName
    dataName = dataName.charAt(0).toLowerCase() + dataName.slice(1);
    @serializeDataObjectKey @options.JSONDataNamePrefix + dataName + @options.JSONDataNameSuffix




  # Goes through the whole data object and sanitizes the keys.
  # Calls `serializeDataObjectKey` for each key.
  serializeDataObject: (obj, child = false) ->
    obj = JSON.parse JSON.stringify obj unless child

    serializedObj = { }
    for key, value of obj
      key = @serializeDataObjectKey key
      value = @serializeDataValue value
      serializedObj[key] = value
    return serializedObj


  # This uses the camelizeJSONDataKeys option
  serializeDataObjectKey: (key) ->
    return key if @options.camelizeJSONDataKeys # They are camelized by default

    key = key.replace /(.)([A-Z]+)/g, "$1_$2"

     # Makes sure that words like mySQLData gets treated properly
    key = key.replace /([A-Z])([A-Z][a-z])/g, "$1_$2"

    key.toLowerCase()


  serializeDataValue: (value) ->
    return value unless value

    if value instanceof Array
      value = (@serializeDataValue(val) for val in value)
    else if typeof value == "object"
      value = @serializeDataObject value, true

    value


  # Goes through the whole data object and deserializes the keys.
  # Calls `deserializeDataObjectKeys` for each key.
  deserializeDataObject: (obj) ->
    deserializedObject = { }
    for key, value of obj
      key = @deserializeDataObjectKey key
      value = @deserializeDataObjectValue value
      deserializedObject[key] = value
    return deserializedObject

  # This uses the camelizeJSONDataKeys option
  deserializeDataObjectKey: (key) ->
    return key if @options.camelizeJSONDataKeys

    key = key.replace /_([a-z])/g, (match, string) -> string.toUpperCase()

    key

  deserializeDataObjectValue: (value) ->
    return value unless value

    if value instanceof Array
      value = (@deserializeDataObjectValue val for val in value)
    else if typeof value == "object"
      value = @deserializeDataObject value

    value



  # Adds a model to be served as rest.
  # 
  # - mongoose model
  # - options. Can be:
  #   - entityView
  #   - collectionView
  #   - entityViewDataName
  #   - collectionViewDataName
  #   - entityViewJSONName
  #   - collectionViewJSONName
  #   - sort the default value to sort by
  #   - ...all defaultOptions can be overriden here, except for urlRoot
  addResource: (model, options = { }) ->
    resource = model: model

    resource.sort = options.sort if options.sort?

    for key, value of @options
      resource[key] = options[key] ? value unless key == "urlRoot"

    resource.pathName = @getPathName resource

    resource.entityView = options.entityView ? @getView resource
    resource.collectionView = options.collectionView ? @getView resource, yes

    resource.entityViewDataName = options.entityViewDataName ? @getViewDataName resource
    resource.collectionViewDataName = options.collectionViewDataName ? @getViewDataName resource, yes

    resource.entityJSONDataName = options.entityJSONDataName ? @getJSONDataName resource
    resource.collectionJSONDataName = options.collectionJSONDataName ? @getJSONDataName resource, yes

    @resources.push resource
    resource


  # Returns a resource for a specific name
  #
  # It checks the resources for singular and plural names!
  #
  # @param  {String} pathOrModel or Model name
  # @return {Object} null if there is no such resource
  getResource: (pathOrModel) ->
    if typeof pathOrModel == "string"
      pathName = pathOrModel
      modelName = pathOrModel
    else
      model = pathOrModel

    for resource in @resources
      return resource if resource.pathName == pathName or resource.model == model or resource.model.modelName == modelName

    null



  # All interceptors are called with following parameters:
  # 
  # - `info` For the parameters inside the info object please look at
  # the post, put and delete methods.
  # - `done` A function that has to be called as soon as the interceptor is done!
  # `done()` can be invoked with an error as first parameter which will stop the
  # execution of the interceptors, and display the error.
  # - `req`
  # - `res`
  # - `next`
  # 
  # @param {Model} model
  # @param {String} eventOrEvents
  # @param {Function} handler
  addInterceptor: (pathOrModel, eventOrEvents, handler) ->

    resource = @getResource pathOrModel

    modelName = if typeof pathOrModel == "string" then pathOrModel else pathOrModel.modelName

    # Check that the resource has already been defined.
    throw new Error("The resource #{modelName} is not defined!") unless resource

    modelName = resource.model.modelName

    # Make sure it's an array
    events = [ ].concat eventOrEvents

    for event in events
      @interceptors[modelName] = { }  unless @interceptors[modelName]
      @interceptors[modelName][event] = [ ]  unless @interceptors[modelName][event]
      @interceptors[modelName][event].push handler



  # Calls all interceptors for given resource and event.
  # Every invoked interceptor **has to** call `done()` when it's finished processing.
  # 
  # The event `get-collection` is a special event that fires the `get` event for each document that has been fetched.
  # 
  # @param {String} model
  # @param {String} event
  # @param {Object} info
  # @param {Request} req
  # @param {Response} res
  # @param {Function} next
  # @param {Function} next
  # @param {Function} onFinish Called when all (if any) interceptors finished.
  invokeInterceptors: (model, event, info, req, res, next, onFinish) ->

    modelName = model.modelName

    realEvent = event
    
    # get-collection is a pseudo event which triggers the get event for each doc individually
    event = "get" if event is "get-collection"

    # There are no interceptors for this particular model & event
    return onFinish() unless @interceptors[modelName]?[event]
      
    finishedInvoking = false
    interceptorCount = 0
    finishedInterceptors = 0
    error = null

    checkIfFinished = ->
      onFinish() if not error and finishedInvoking and (finishedInterceptors is interceptorCount)

    done = (err) ->
      
      # If an error already occured, ignore the other interceptors.
      return if error
      if err
        error = err
        onFinish err
      else
        finishedInterceptors++
        checkIfFinished()

    
    # Using all so it's possible to break the loop if an error occurs.
    _.all @interceptors[modelName][event], (interceptor) ->
      if realEvent isnt "get-collection"
        interceptorCount++
        interceptor info, done, req, res, next
      else
        
        # Iterate over each document and invoke the 'get' interceptor for it.
        _.all info.docs, (doc) ->
          interceptorCount++
          interceptor
            doc: doc
          , done, req, res, next
          (if error then false else true) # Break the loop if there is an error.

      (if error then false else true) # Break the loop if there is an error.

    finishedInvoking = true
    checkIfFinished()



  # Returns the url for a resource collection
  getCollectionUrl: (resource) ->
    @options.urlRoot + resource.pathName


  # Returns the url for a specific doc
  getEntityUrl: (resource, doc) ->
    return @getCollectionUrl resource unless resource.singleView
    @options.urlRoot + resource.pathName + "/" + doc._id
      


  # This only actually flashes if this is not an XHR.
  # 
  # Forwards to `req.flash()`
  flash: (type, msg, req) ->
    req.flash type, msg  if not req.xhr or not req.resource.enableXhr


  # Called when there was an error.
  # 
  # If there is a redirectUrl (and not XHR), it will redirect there.
  # 
  # Either calles next with the error or returns it as XMLHttp.
  # 
  # @api private
  renderError: (err, req, res, next, errCode = 500, redirectUrl = null) ->
    if req.resource.enableXhr and req.xhr
      res.send errCode, err.message
    else
      res.status errCode if errCode?

      if redirectUrl
        req.flash "error", err.message
        @redirect redirectUrl, req, res, next
      else
        next err


  _getPathName: (model) ->

  _serializeEntityName: (key, resource) ->


  _serializeKeyName: (key, resource) ->


  ###
  Called to render a collection of docs

  @param  {Object}   err
  @param  {Object}   req
  @param  {Object}   res
  @param  {Function} next
  @api private
  ###
  renderCollection: (docs, req, res, next) ->
    resource = req.resource
    data = { }

    if resource.enableXhr and req.xhr
      data[resource.collectionJSONDataName] = (doc.toObject() for doc in docs)
      res.send @serializeDataObject data
    else
      data[resource.collectionViewDataName] = (doc.toObject() for doc in docs)
      data.site = req.params.resourceName + "-list"
      res.render resource.collectionView, data



  # Called to render a collection of docs
  renderEntity: (doc, req, res, next) ->
    resource = req.resource
    data = { }

    if resource.enableXhr and req.xhr
      data[resource.entityJSONDataName] = doc.toObject()
      res.send @serializeDataObject data
    else
      data[resource.entityViewDataName] = doc.toObject()
      data.site = req.params.resourceName + "-show"
      res.render resource.entityView, data



  # Called to redirect
  redirect: (address, req, res, next) ->
    resource = req.resource
    if resource.enableXhr and req.xhr
      res.send redirect: address
    else
      res.redirect address


  # All entities rest functions have to go through this first.
  # This function makes sure the resource is actually served, and
  # puts the right model in the req object
  collection: ->
    (req, res, next) =>
      req.resource = @getResource req.params.resourceName
      next()


  # Renders a view with the list of all docs.
  collectionGet: ->
    (req, res, next) =>
      return next() unless req.resource
        
      query = req.resource.model.find()
      query.sort req.resource.sort if req.resource.sort

      query.exec (err, docs) =>
        return @renderError err, req, res, next if err
          
        info = docs: docs
        finish = => @renderCollection docs, req, res, next
        
        # That's not a real interceptor, it invokes the get interceptor for each doc.
        @invokeInterceptors req.resource.model, "get-collection", info, req, res, next, finish


  # Handles the new values, and redirects to the list.
  # 
  # It invokes the `post` interceptors. The info object consists of:
  # 
  # - `values` The new values that are about to be inserted. You can set a new object and it will be used.
  # - `doc` Only for `success` or `error` interceptors. The document that was just inserted.
  # - `err` The exception, only for error interceptors.
  collectionPost: ->
    (req, res, next) =>
      return next() unless req.resource
        
      self = this
      throw new Error("Nothing submitted.")  if not req.body or not req.body[req.resource.entityJSONDataName]
      info = values: @deserializeDataObject req.body[req.resource.entityJSONDataName]
      redirectUrl = self.getCollectionUrl(req.resource)
      error = (err) ->
        info.err = err
        self.invokeInterceptors req.resource.model, "post.error", info, req, res, next, (interceptorErr) ->
          finalErr = interceptorErr or err
          self.renderError new Error("Unable to insert the record: " + finalErr.message), req, res, next, 500, redirectUrl

      @invokeInterceptors req.resource.model, "post", info, req, res, next, (err) ->
        return error err if err
          
        doc = new req.resource.model(info.values)

        doc.save (err) ->
          return error err if err

          info.doc = doc
          self.invokeInterceptors req.resource.model, "post.success", info, req, res, next, (err) ->
            return error err if err
              
            if req.resource.enableXhr and req.xhr
              self.renderEntity info.doc, req, res, next
            else
              self.flash "success", "Successfully inserted the record.", req
              self.redirect redirectUrl, req, res, next



  # All entity rest functions have to go through this first.
  # This function is in charge of loading the entity.
  entity: ->
    (req, res, next) =>
      return next() unless req.resource = @getResource req.params.resourceName
        
      req.resource.model.findOne { _id: req.params.id }, (err, doc) =>
        if err
          @renderError err, req, res, next, 500, @getCollectionUrl(req.resource)
        unless doc
          @renderError new Error("Document with id #{req.params.id} not found."), req, res, next, 404
        else
          req.doc = doc
          next()


  # Gets a single entity
  # 
  # Returns a function to use as route.
  entityGet: ->
    (req, res, next) =>
      return next() unless req.resource
        
      self = this

      info = doc: req.doc
      error = (err) ->
        info.err = err
        self.invokeInterceptors req.resource.model, "get.error", info, req, res, next, (interceptorErr) ->
          finalErr = interceptorErr or err
          self.renderError new Error("Unable to get the record: " + finalErr.message), req, res, next


      onFinish = (err) ->
        if err
          error err
          return
        self.renderEntity info.doc, req, res, next

      @invokeInterceptors req.resource.model, "get", info, req, res, next, onFinish


  ###
  Updates a resource with the given parameters.

  It invokes the `put` and `put.error` or `put.success` interceptors. The info object consists of:

  - `values` The new values that are about to be inserted. You can set a new object and it will be used.
  - `doc` The document that is about to be updated.
  - `err` The exception, only for error interceptors.

  @return {Function} The function to use as route
  ###
  entityPut: ->
    (req, res, next) =>
      return next() unless req.resource

      self = this
      throw new Error("Nothing submitted.") if not req.body or not req.body[req.resource.entityJSONDataName]
      info =
        doc: req.doc
        values: @deserializeDataObject req.body[req.resource.entityJSONDataName]

      redirectUrl = self.getEntityUrl req.resource, req.doc

      error = (err) ->
        info.err = err
        self.invokeInterceptors req.resource.model, "put.error", info, req, res, next, (interceptorErr) ->
          finalErr = interceptorErr or err
          self.renderError new Error("Unable to save the record: " + finalErr.message), req, res, next, 500, redirectUrl


      @invokeInterceptors req.resource.model, "put", info, req, res, next, (err) ->
        return error err if err?
          
        req.doc.set info.values

        req.doc.save (err) ->
          return error err if err?
            
          self.invokeInterceptors req.resource.model, "put.success", info, req, res, next, (err) ->
            return error err if err?
            
            if req.resource.enableXhr and req.xhr
              self.renderEntity req.doc, req, res, next
            else
              self.flash "success", "Successfully updated the record.", req
              self.redirect redirectUrl, req, res, next


  ###
  Deletes the resource.

  It invokes the `delete` and `delete.error` or `delete.success` interceptors. The info object consists of:

  - `doc` The document that is about to be deleted.
  - `err` The exception, only for error interceptors.

  @return {Function} The function to use as route
  ###
  entityDelete: ->
    (req, res, next) =>
      unless req.resource
        next()
        return
      info = doc: req.doc
      self = this
      redirectUrl = self.getCollectionUrl(req.resource)
      error = (err) ->
        info.err = err
        self.invokeInterceptors req.resource.model, "delete.error", info, req, res, next, (interceptorErr) ->
          finalErr = interceptorErr or err
          self.renderError new Error("Unable to delete the record: " + finalErr.message), req, res, next, 500, redirectUrl


      @invokeInterceptors req.resource.model, "delete", info, req, res, next, (err) ->
        if err
          error err
          return
        req.doc.remove (err) ->
          if err
            error err
            return
          self.invokeInterceptors req.resource.model, "delete.success", info, req, res, next, (err) ->
            if err
              error err
              return
            self.flash "success", "Successfully deleted the record.", req
            self.redirect redirectUrl, req, res, next


# Exporting the Class
module.exports = exports = MongoRest
