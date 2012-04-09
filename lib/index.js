/*!
 * REST Api
 * Copyright(c) 2012 Matias Meno
 */

/**
 * Module dependencies.
 */
var _ = require('underscore');

/**
 * The models for which there will be a rest interface
 * 
 * `options` can have following values:
 * 
 *     - `urlPath` The path prefix for the rest resources. Default to `/`
 *     - `viewPath` the path where the views to render the resources are located. Defaults to `''`
 *     - `viewPrefix` The prefix for a resource view file. Default to `'resource_'`
 *     - `enableXhr` Enables a JSON interface for XMLHttpRequests. Make sure you don't leak important information!
 *     - `singleView` Whether there is a single view or not. If not, only the collection view will be used.
 * 
 * @param {Object} app The express app object to register the routes to.
 * @param {Object} options Options for this MongoRest instance
 */
var MongoRest = function(app, options) {
  this.app = app;
  this.options = _.extend({ urlPath: '/', viewPath: '', viewPrefix: 'resource_', enableXhr: false, singleView: true }, options || {});
  // The models for which there will be a rest interface
  this.availableModels = { };
  // Interceptors for specific events.
  this.interceptors = { };

  this.registerRoutes();
};

/**
 * Exporting the Class
 * @type {Function}
 */
module.exports = exports = MongoRest;


/**
 * Registers all REST routes with the provided `app` object.
 */
MongoRest.prototype.registerRoutes = function() {
  /**
   * Accessing multiple resources
   */
  // This makes sure the resource actually exists and prepares the model for the `get` and `post` actions.
  this.app.all(this.options.urlPath + ':resource', this.collection());

  this.app.get(this.options.urlPath + ':resource', this.collectionGet());
  this.app.post(this.options.urlPath + ':resource', this.collectionPost());

  /**
   * Accessing single entities
   */ 
  // This makes sure the resource exists, and loads the model for the `get`, `put` and `delete` actions.
  this.app.all(this.options.urlPath + ':resource/id/:id', this.entity());

  this.app.get(this.options.urlPath + ':resource/id/:id', this.entityGet());
  this.app.put(this.options.urlPath + ':resource/id/:id', this.entityPut());
  this.app.delete(this.options.urlPath + ':resource/id/:id', this.entityDelete());
};

/**
 * Adds a model to be served as rest.
 * @param {String} name
 * @param {Object} model
 */
MongoRest.prototype.addResource = function(name, model) {
  this.availableModels[name] = model;
};
 


/**
 * All interceptors are called with following parameters:
 * 
 *   - `info` For the parameters inside the info object please look at
 *            the post, put and delete methods.
 *   - `req`
 *   - `res`
 *   - `next`
 * 
 * @param {String} resource
 * @param {String} event
 * @param {Function} handler
 */
MongoRest.prototype.addInterceptor = function(resource, event, handler) {
  var interceptors = this.interceptors;
  if (!_.isArray(event)) event = [event];
  _.each(event, function(event) {
    if (!interceptors[resource]) interceptors[resource] = {};
    if (!interceptors[resource][event]) interceptors[resource][event] = [];
    interceptors[resource][event].push(handler);
  });
};

/**
 * Calls all interceptors for given resource and event.
 * @param {String} resource
 * @param {String} event
 * @param {Object} params
 * @param {Function} invokingInterceptorCallback Called whenever an interceptor gets invoked.
 */
MongoRest.prototype.DEPR_invokeInterceptors = function(resource, event, params, invokingInterceptorCallback) {
  var interceptors = this.interceptors;
  if (!interceptors[resource] || !interceptors[resource][event]) return;

  _.each(interceptors[resource][event], function(interceptor) {
    invokingInterceptorCallback();
    interceptor.apply(this, params);
  });
};

/**
 * Calls all interceptors for given resource and event.
 * Every invoked interceptor **has to** call `done()` when it's finished processing.
 * 
 * @param {String} resource
 * @param {String} event
 * @param {Object} info
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
 * @param {Function} next
 * @param {Function} onFinish Called when all (if any) interceptors finished.
 */
MongoRest.prototype.invokeInterceptors = function(resource, event, info, req, res, next, onFinish) {
  var interceptors = this.interceptors
    , realEvent = event;

  // -get-collection is a pseudo event which triggers the get event for each doc individually
  if (event === '-get-collection') event = 'get';

  if (!interceptors[resource] || !interceptors[resource][event]) {
    onFinish();
    return;
  }

  var finishedInvoking = false
    , interceptorCount = 0
    , finishedInterceptors = 0
    , checkIfFinished = function() {
      if (finishedInvoking && finishedInterceptors === interceptorCount) {
        onFinish();
      }
    }
    , done = function() {
      finishedInterceptors ++;
      checkIfFinished();
    }
  ;

  _.each(interceptors[resource][event], function(interceptor) {
    if (realEvent !== '-get-collection') {
      interceptorCount ++;
      interceptor(info, done, req, res, next);
    }
    else {
      // Iterate over each document and invoke the 'get' interceptor for it.
      _.each(info.docs, function(doc) {
        interceptorCount ++;
        interceptor({ doc: doc }, done, req, res, next);
      });
    }
  });
  finishedInvoking = true;
  checkIfFinished();
};


/**
 * Called when there was an error.
 * Either calles next with the error or returns it as XMLHttp.
 * 
 * @param  {Object}   err  
 * @param  {Object}   req  
 * @param  {Object}   res  
 * @param  {Function} next 
 * @api private
 */
MongoRest.prototype.renderError = function (err, req, res, next) {
  if (this.options.enableXhr && req.xhr) res.send({ error: err });
  else next(err);
};


/**
 * Called to render a collection of docs 
 * 
 * @param  {Object}   err  
 * @param  {Object}   req  
 * @param  {Object}   res  
 * @param  {Function} next 
 * @api private
 */
MongoRest.prototype.renderCollection = function (docs, req, res, next) {
  if (this.options.enableXhr && req.xhr) {
    res.send({ docs: docs });
  }
  else {
    res.render(this.options.viewPath + this.options.viewPrefix + req.params.resource, { docs: docs, site: req.params.resource + '-list' });
  }
};




/**
 * Called to render a collection of docs 
 * 
 * @param  {Object}   err  
 * @param  {Object}   req  
 * @param  {Object}   res  
 * @param  {Function} next 
 * @api private
 */
 MongoRest.prototype.renderEntity = function (doc, req, res, next) {
  if (this.options.enableXhr && req.xhr) res.send({ doc: doc });
  else res.render(this.options.viewPath + this.options.viewPrefix + req.params.resource + '_show', { doc: doc, site: req.params.resource + '-show' });
};





/**
 * All entities rest functions have to go through this first.
 * This function makes sure the resource is actually served, and
 * puts the right model in the req object
 *
 * @return {Function} The function to use as route
 */
MongoRest.prototype.collection = function() { return _.bind(function(req, res, next) {
  if (!this.availableModels[req.params.resource]) { next(); return; }

  req.model = this.availableModels[req.params.resource];

  next();
}, this); };


/**
 * Renders a view with the list of all docs.
 * 
 * @return {Function} The function to use as route
 */
MongoRest.prototype.collectionGet = function() { return _.bind(function(req, res, next) {
  if (!req.model) { next(); return; }

  var self = this;

  req.model.find().sort('date', 'descending').run(function(err, docs) {
    if (err) {
      self.renderError(err, req, res, next);
      return;
    }
    else {

      var info = { docs: docs }
        , finish = function() { self.renderCollection(docs, req, res, next); };

      // That's not a real interceptor, it invokes the get interceptor for each doc.
      self.invokeInterceptors(req.params.resource, '-get-collection', info, req, res, next, finish);
    }
  });
}, this); };

/**
 * Handles the new values, and redirects to the list.
 * 
 * It invokes the `post` interceptors. The info object consists of:
 * 
 *   - `values` The new values that are about to be inserted. You can set a new object and it will be used.
 *   - `doc` Only for `success` or `error` interceptors. The document that was just inserted.
 *   - `err` The exception, only for error interceptors.
 * 
 * @return {Function} The function to use as route
 */
MongoRest.prototype.collectionPost = function() { return _.bind(function(req, res, next) {
  if (!req.model) { next(); return; }
  var self = this;

  if (!req.body || !req.body.newResource) throw new Error('Nothing submitted.');

  var info = { values: req.body.newResource };

  this.DEPR_invokeInterceptors(req.params.resource, 'post', [ info, req, res, next ]);

  var model = new req.model(info.values);

  model.save(function(err) {
    info.doc = model;
    if (err) {
      info.err = err;
      self.DEPR_invokeInterceptors(req.params.resource, 'post.error', [ info, req, res, next ]);
      req.flash('error', 'Error: ' + err.message)
    }
    else {
      self.DEPR_invokeInterceptors(req.params.resource, 'post.success', [ info, req, res, next ]);
    }
    res.redirect(self.options.urlPath + req.params.resource);
  });
}, this); };


/**
 * All entity rest functions have to go through this first.
 * This function is in charge of loading the entity.
 *
 * @return {Function} The function to use as route
 */
MongoRest.prototype.entity = function() { return _.bind(function(req, res, next) {
  var self = this;
  if (!this.availableModels[req.params.resource]) { next(); return; }

  req.model = this.availableModels[req.params.resource];

  req.model.findOne({ _id: req.params.id }, function(err, doc) {
    if (err) {
      req.flash('error', err.message);
      res.redirect(self.options.urlPath + req.params.resource);
      return;
    }
    req.doc = doc;
    next();
  });
}, this); };

/**
 * Gets a single entity
 * 
 * @return {Function} The function to use as route
 */
MongoRest.prototype.entityGet = function() { return _.bind(function(req, res, next) {
  if (!req.model) { next(); return; }

  var info = { doc: req.doc };

  this.DEPR_invokeInterceptors(req.params.resource, 'get', [ info, req, res, next ]);

  this.renderEntity(info.doc, req, res, next);
}, this); };

/**
 * Updates a resource with the given parameters.
 * 
 * It invokes the `put` and `put.error` or `put.success` interceptors. The info object consists of:
 * 
 *   - `values` The new values that are about to be inserted. You can set a new object and it will be used.
 *   - `doc` The document that is about to be updated.
 *   - `err` The exception, only for error interceptors.
 * 
 * @return {Function} The function to use as route
 */
MongoRest.prototype.entityPut = function() { return _.bind(function(req, res, next) {
  if (!req.model) { next(); return; }

  var self = this;
  if (!req.body || !req.body.newResource) throw new Error('Nothing submitted.');

  var info = { doc: req.doc, values: req.body.newResource };

  this.DEPR_invokeInterceptors(req.params.resource, 'put', [ info, req, res, next ]);

  _.each(info.values, function(value, name) {
    req.doc[name] = value;
  });

  req.doc.save(function(err) {
    if (err) {
      info.err = err;
      self.DEPR_invokeInterceptors(req.params.resource, 'put.error', [ info, req, res, next ]);
      req.flash('error', 'Unable to save the record: ' + err.message)
    }
    else {
      self.DEPR_invokeInterceptors(req.params.resource, 'put.success', [ info, req, res, next ]);
      req.flash('success', 'Successfully updated the record.')
    }

    res.redirect(self.options.urlPath + req.params.resource + (self.options.singleView ? '/id/' + req.doc._id : ''));
  });

}, this); };

/**
 * Deletes the resource.
 * 
 * It invokes the `delete` and `delete.error` or `delete.success` interceptors. The info object consists of:
 * 
 *   - `doc` The document that is about to be deleted.
 *   - `err` The exception, only for error interceptors.
 * 
 * @return {Function} The function to use as route
 */
MongoRest.prototype.entityDelete = function() { return _.bind(function(req, res, next) {
  if (!req.model) { next(); return; }

  var info = { doc: req.doc }
    , self = this;
  this.DEPR_invokeInterceptors(req.params.resource, 'delete', [ info, req, res, next ]);

  req.doc.remove(function(err) {
    if (err) {
      info.err = err;
      self.DEPR_invokeInterceptors(req.params.resource, 'delete.error', [ info, req, res, next ]);
      throw err;
    }
    self.DEPR_invokeInterceptors(req.params.resource, 'delete.success', [ info, req, res, next ]);
    res.redirect(self.options.urlPath + req.params.resource);
  });
}, this); };


