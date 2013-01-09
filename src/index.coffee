# REST Api
# Copyright(c) 2012 Matias Meno


# Module dependencies.
_ = require "underscore"


# The models for which there will be a rest interface
# 
# `options` can have following values:
# 
# - `urlPath` The path prefix for the rest resources. Default to `/`
# - `entityViewTemplate` The template that will be used as view name to render entity resources. `{{singularName}}` and `{{pluralName}}` can be used and will be substituted
# - `collectionViewTemplate` The template that will be used as view name to render collection resources. `{{singularName}}` and `{{pluralName}}` can be used and will be substituted
# - `enableXhr` Enables a JSON interface for XMLHttpRequests. **Make sure you don't leak important information!**
# - `singleView` Whether there is a single view or not. If not, only the collection view will be used.

class MongoRest

  defaultOptions:
    # The path prefix for the rest resources.
    urlPath: "/"
    # The template that will be used as view name to render entity resources.
    # `{{singularName}}` and `{{pluralName}}` can be used and will be
    # substituted
    entityViewTemplate: "resource_{{singularName}}"
    # The template that will be used as view name to render collection
    # resources. `{{singularName}}` and `{{pluralName}}` can be used and will
    # be substituted
    collectionViewTemplate: "resource_{{pluralName}}"

    # The name that will be used as index in the template models or JSON.
    entityDataName: "{{singularName}}" # You can use {{singularName}} and {{pluralName}} again
    collectionDataName: "{{pluralName}}"

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
    
    ###
    Accessing multiple resources
    ###
    
    # This makes sure the resource actually exists and prepares the model for the `get` and `post` actions.
    @app.all @options.urlPath + ":resourceName", @collection()
    @app.get @options.urlPath + ":resourceName", @collectionGet()
    @app.post @options.urlPath + ":resourceName", @collectionPost()
    
    ###
    Accessing single entities
    ###
    
    # This makes sure the resource exists, and loads the model for the `get`, `put` and `delete` actions.
    @app.all @options.urlPath + ":resourceName/:id", @entity()
    @app.get @options.urlPath + ":resourceName/:id", @entityGet()
    @app.put @options.urlPath + ":resourceName/:id", @entityPut()
    @app["delete"] @options.urlPath + ":resourceName/:id", @entityDelete()


  # Adds a model to be served as rest.
  # 
  # - singularName E.g.: `'user'`
  # - mongoose model
  # - options. Can be:
  #   - pluralName
  #   - sort the default value to sort by
  #   - ...all defaultOptions can be overriden here, except for urlPath
  addResource: (singularName, model, options = { }) ->
    pluralName = pluralName or singularName + "s"
    resource =
      singularName: singularName
      pluralName: options.pluralName ? singularName + "s"
      model: model

    resource.sort = options.sort if options.sort?

    throw new Exception("The singular and plural name have to be different.")  if resource.pluralName is resource.singularName

    for key, value of @options
      resource[key] = options[key] ? value unless key == "urlPath"

    resource.entityViewTemplate = @_substituteNames resource.entityViewTemplate, resource
    resource.collectionViewTemplate = @_substituteNames resource.collectionViewTemplate, resource

    resource.entityDataName = @_substituteNames resource.entityDataName, resource
    resource.collectionDataName = @_substituteNames resource.collectionDataName, resource

    @resources.push resource

  # Parses a string and substitutes singular and plural names.
  _substituteNames: (str, resource) ->
    str.replace("{{singularName}}", resource.singularName).replace "{{pluralName}}", resource.pluralName


  # Returns a resource for a specific name
  #
  # It checks the resources for singular and plural names!
  #
  # @param  {String} name Singular or plural
  # @return {Model} null if there is no such resource
  getResource: (name) ->
    _.find @resources, (resource) ->
      resource.pluralName is name or resource.singularName is name



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
  # @param {String} resourceName
  # @param {String} event
  # @param {Function} handler
  addInterceptor: (resourceName, event, handler) ->
    resource = @getResource resourceName
    interceptors = @interceptors
    throw new Error("The resource " + resourceName + " is not defined!")  unless resource
    resourceName = resource.singularName
    event = [event]  unless _.isArray(event)
    _.each event, (event) ->
      interceptors[resourceName] = {}  unless interceptors[resourceName]
      interceptors[resourceName][event] = []  unless interceptors[resourceName][event]
      interceptors[resourceName][event].push handler



  # Calls all interceptors for given resource and event.
  # Every invoked interceptor **has to** call `done()` when it's finished processing.
  # 
  # The event `get-collection` is a special event that fires the `get` event for each document that has been fetched.
  # 
  # @param {String} singularResourceName
  # @param {String} event
  # @param {Object} info
  # @param {Request} req
  # @param {Response} res
  # @param {Function} next
  # @param {Function} next
  # @param {Function} onFinish Called when all (if any) interceptors finished.
  invokeInterceptors: (singularResourceName, event, info, req, res, next, onFinish) ->
    interceptors = @interceptors
    realEvent = event
    
    # get-collection is a pseudo event which triggers the get event for each doc individually
    event = "get"  if event is "get-collection"
    if not interceptors[singularResourceName] or not interceptors[singularResourceName][event]
      onFinish()
      return
    finishedInvoking = false
    interceptorCount = 0
    finishedInterceptors = 0
    error = null
    checkIfFinished = ->
      onFinish()  if not error and finishedInvoking and (finishedInterceptors is interceptorCount)

    done = (err) ->
      
      # If an error already occured, ignore the other interceptors.
      return  if error
      if err
        error = err
        onFinish err
      else
        finishedInterceptors++
        checkIfFinished()

    
    # Using all so it's possible to break the loop if an error occurs.
    _.all interceptors[singularResourceName][event], (interceptor) ->
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



  ###
  Returns the url for a resource collection

  @param  {Object} resource
  @return {String}
  ###
  getCollectionUrl: (resource) ->
    @options.urlPath + resource.pluralName


  ###
  Returns the url for a specific doc

  @param  {Object} resource
  @param  {Doc} doc
  @return {String}
  ###
  getEntityUrl: (resource, doc) ->
    (if resource.singleView then @options.urlPath + resource.singularName + "/" + doc._id else @getCollectionUrl(resource))


  ###
  This only actually flashes if this is not an XHR.

  Forwards to `req.flash()`

  @param  {String} type
  @param  {String} msg
  @param  {Req} req
  ###
  flash: (type, msg, req) ->
    req.flash type, msg  if not req.xhr or not req.resource.enableXhr


  ###
  Called when there was an error.

  If there is a redirectUrl (and not XHR), it will redirect there.

  Either calles next with the error or returns it as XMLHttp.

  @param  {Error}   err
  @param  {String}   Redirect url. If set it will redirect, otherwise call next() with error.
  @param  {Object}   req
  @param  {Object}   res
  @param  {Function} next
  @api private
  ###
  renderError: (err, redirectUrl, req, res, next) ->
    if req.resource.enableXhr and req.xhr
      obj = error: err.message
      redirectUrl and (obj.redirect = redirectUrl)
      res.send obj
    else
      if redirectUrl
        req.flash "error", err.message
        @redirect redirectUrl, req, res, next
      else
        next err


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
    data[resource.collectionDataName] = docs

    if resource.enableXhr and req.xhr
      res.send data
    else
      data.site = req.params.resourceName + "-list"
      res.render resource.collectionViewTemplate, data



  # Called to render a collection of docs
  renderEntity: (doc, req, res, next) ->
    resource = req.resource
    data = { }
    data[resource.entityDataName] = doc

    if resource.enableXhr and req.xhr
      res.send data
    else
      data.site = req.params.resourceName + "-show"
      res.render resource.entityViewTemplate, data



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
      req.resource = @getResource(req.params.resourceName)
      next()


  ###
  Renders a view with the list of all docs.

  @return {Function} The function to use as route
  ###
  collectionGet: ->
    _.bind ((req, res, next) ->
      unless req.resource
        next()
        return
      self = this
      query = req.resource.model.find()
      if req.resource.sort
        _.each req.resource.sort, (sort) ->
          query.sort sort[0], sort[1]

      query.exec (err, docs) ->
        if err
          self.renderError err, null, req, res, next
          return
        else
          info = docs: docs
          finish = ->
            self.renderCollection docs, req, res, next

          
          # That's not a real interceptor, it invokes the get interceptor for each doc.
          self.invokeInterceptors req.resource.singularName, "get-collection", info, req, res, next, finish

    ), this


  ###
  Handles the new values, and redirects to the list.

  It invokes the `post` interceptors. The info object consists of:

  - `values` The new values that are about to be inserted. You can set a new object and it will be used.
  - `doc` Only for `success` or `error` interceptors. The document that was just inserted.
  - `err` The exception, only for error interceptors.

  @return {Function} The function to use as route
  ###
  collectionPost: ->
    _.bind ((req, res, next) ->
      unless req.resource
        next()
        return
      self = this
      throw new Error("Nothing submitted.")  if not req.body or not req.body.newResource
      info = values: req.body.newResource
      redirectUrl = self.getCollectionUrl(req.resource)
      error = (err) ->
        info.err = err
        self.invokeInterceptors req.resource.singularName, "post.error", info, req, res, next, (interceptorErr) ->
          finalErr = interceptorErr or err
          self.renderError new Error("Unable to insert the record: " + finalErr.message), redirectUrl, req, res, next


      @invokeInterceptors req.resource.singularName, "post", info, req, res, next, (err) ->
        if err
          error err
          return
        doc = new req.resource.model(info.values)
        doc.save (err) ->
          if err
            error err
            return
          info.doc = doc
          self.invokeInterceptors req.resource.singularName, "post.success", info, req, res, next, (err) ->
            if err
              error err
              return
            self.flash "success", "Successfully inserted the record.", req
            if req.resource.enableXhr and req.xhr
              self.renderEntity info.doc, req, res, next
            else
              self.redirect redirectUrl, req, res, next



    ), this


  ###
  All entity rest functions have to go through this first.
  This function is in charge of loading the entity.

  @return {Function} The function to use as route
  ###
  entity: ->
    _.bind ((req, res, next) ->
      self = this
      unless req.resource = @getResource(req.params.resourceName)
        next()
        return
      req.resource.model.findOne
        _id: req.params.id
      , (err, doc) ->
        if err
          self.renderError err, self.getCollectionUrl(req.resource), req, res, next
          return
        req.doc = doc
        next()

    ), this


  ###
  Gets a single entity

  @return {Function} The function to use as route
  ###
  entityGet: ->
    _.bind ((req, res, next) ->
      unless req.resource
        next()
        return
      self = this
      info = doc: req.doc
      error = (err) ->
        info.err = err
        self.invokeInterceptors req.resource.singularName, "get.error", info, req, res, next, (interceptorErr) ->
          finalErr = interceptorErr or err
          self.renderError new Error("Unable to get the record: " + finalErr.message), null, req, res, next


      onFinish = (err) ->
        if err
          error err
          return
        self.renderEntity info.doc, req, res, next

      @invokeInterceptors req.resource.singularName, "get", info, req, res, next, onFinish
    ), this


  ###
  Updates a resource with the given parameters.

  It invokes the `put` and `put.error` or `put.success` interceptors. The info object consists of:

  - `values` The new values that are about to be inserted. You can set a new object and it will be used.
  - `doc` The document that is about to be updated.
  - `err` The exception, only for error interceptors.

  @return {Function} The function to use as route
  ###
  entityPut: ->
    _.bind ((req, res, next) ->
      return next() unless req.resource

      self = this
      throw new Error("Nothing submitted.") if not req.body or not req.body.newResource
      info =
        doc: req.doc
        values: req.body.newResource

      redirectUrl = self.getEntityUrl req.resource, req.doc

      error = (err) ->
        info.err = err
        self.invokeInterceptors req.resource.singularName, "put.error", info, req, res, next, (interceptorErr) ->
          finalErr = interceptorErr or err
          self.renderError new Error("Unable to save the record: " + finalErr.message), redirectUrl, req, res, next


      @invokeInterceptors req.resource.singularName, "put", info, req, res, next, (err) ->
        return error err if err?
          
        _.each info.values, (value, name) ->
          req.doc[name] = value

        req.doc.save (err) ->
          return error err if err?
            
          self.invokeInterceptors req.resource.singularName, "put.success", info, req, res, next, (err) ->
            return error err if err?
              
            self.flash "success", "Successfully updated the record.", req
            self.redirect redirectUrl, req, res, next



    ), this


  ###
  Deletes the resource.

  It invokes the `delete` and `delete.error` or `delete.success` interceptors. The info object consists of:

  - `doc` The document that is about to be deleted.
  - `err` The exception, only for error interceptors.

  @return {Function} The function to use as route
  ###
  entityDelete: ->
    _.bind ((req, res, next) ->
      unless req.resource
        next()
        return
      info = doc: req.doc
      self = this
      redirectUrl = self.getCollectionUrl(req.resource)
      error = (err) ->
        info.err = err
        self.invokeInterceptors req.resource.singularName, "delete.error", info, req, res, next, (interceptorErr) ->
          finalErr = interceptorErr or err
          self.renderError new Error("Unable to delete the record: " + finalErr.message), redirectUrl, req, res, next


      @invokeInterceptors req.resource.singularName, "delete", info, req, res, next, (err) ->
        if err
          error err
          return
        req.doc.remove (err) ->
          if err
            error err
            return
          self.invokeInterceptors req.resource.singularName, "delete.success", info, req, res, next, (err) ->
            if err
              error err
              return
            self.flash "success", "Successfully deleted the record.", req
            self.redirect redirectUrl, req, res, next



    ), this

# Exporting the Class
module.exports = exports = MongoRest
