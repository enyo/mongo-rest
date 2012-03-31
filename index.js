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
 * 
 * @param {Object} app The express app object to register the routes to.
 * @param {Object} options Options for this MongoRest instance
 */
var MongoRest = function(app, options) {
  this.app = app;
  this.options = _.extend({ urlPath: '/', viewPath: '', viewPrefix: 'resource_' }, options || {});
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
 * @param  {String} resource
 * @param  {String} event
 * @param  {Object} params
 */
MongoRest.prototype.invokeInterceptors = function(resource, event, params) {
  var interceptors = this.interceptors;
  if (!interceptors[resource] || !interceptors[resource][event]) return;

  _.each(interceptors[resource][event], function(interceptor) {
    interceptor.apply(this, params);
  });
};







/**
 * All entities rest functions have to go through this first.
 * This function makes sure the resource is actually served, and
 * puts the right model in the req object
 *
 * @return {Function} The function to use as route
 */
MongoRest.prototype.collection = function() { return _.bind(function(req, res, next) {
  if (!this.availableModels[req.params.resource]) throw new Error('Undefined resource: ' + req.params.resource);

  req.model = this.availableModels[req.params.resource];

  next();
}, this); };


/**
 * Renders a view with the list of all docs.
 * 
 * @return {Function} The function to use as route
 */
MongoRest.prototype.collectionGet = function() { return _.bind(function(req, res, next) {
  var self = this;
  req.model.find().sort('date', 'descending').run(function(err, docs) {
    if (err) {
      next(err);
      return;
    }
    else {
      res.render(self.options.viewPath + self.options.viewPrefix + req.params.resource, { docs: docs, site: req.params.resource + '-list' });
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
  var self = this;

  if (!req.body || !req.body.newResource) throw new Error('Nothing submitted.');

  var info = { values: req.body.newResource };

  this.invokeInterceptors(req.params.resource, 'post', [ info, req, res, next ]);

  var model = new req.model(info.values);

  model.save(function(err) {
    info.doc = model;
    if (err) {
      info.err = err;
      self.invokeInterceptors(req.params.resource, 'post.error', [ info, req, res, next ]);
      req.flash('error', 'Error: ' + err.message)
    }
    else {
      self.invokeInterceptors(req.params.resource, 'post.success', [ info, req, res, next ]);
    }
    res.redirect('/admin/resources/' + req.params.resource);
  });
}, this); };


/**
 * All entity rest functions have to go through this first.
 * This function is in charge of loading the entity.
 *
 * @return {Function} The function to use as route
 */
MongoRest.prototype.entity = function() { return _.bind(function(req, res, next) {
  if (!this.availableModels[req.params.resource]) throw new Error('Undefined resource: ' + req.params.resource);

  req.model = this.availableModels[req.params.resource];

  req.model.findOne({ _id: req.params.id }, function(err, doc) {
    if (err) {
      req.flash('error', err.message);
      res.redirect('/admin/resources/' + req.params.resource);
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
  this.invokeInterceptors(req.params.resource, 'get', [ req.doc, req, res, next ]);

  res.render(this.options.viewPath + this.options.viewPrefix + req.params.resource + '_show', { doc: req.doc, site: req.params.resource + '-show' });
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
  var self = this;
  if (!req.body || !req.body.newResource) throw new Error('Nothing submitted.');

  var info = { doc: req.doc, values: req.body.newResource };

  this.invokeInterceptors(req.params.resource, 'put', [ info, req, res, next ]);

  _.each(info.values, function(value, name) {
    req.doc[name] = value;
  });

  req.doc.save(function(err) {
    if (err) {
      info.err = err;
      self.invokeInterceptors(req.params.resource, 'put.error', [ info, req, res, next ]);
      req.flash('error', 'Unable to save the record: ' + err.message)
    }
    else {
      self.invokeInterceptors(req.params.resource, 'put.success', [ info, req, res, next ]);
      req.flash('success', 'Successfully updated the record.')
    }

    res.redirect('/admin/resources/' + req.params.resource + '/id/' + req.doc._id);
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
  var info = { doc: req.doc }
    , self = this;
  this.invokeInterceptors(req.params.resource, 'delete', [ info, req, res, next ]);

  req.doc.remove(function(err) {
    if (err) {
      info.err = err;
      self.invokeInterceptors(req.params.resource, 'delete.error', [ info, req, res, next ]);
      throw err;
    }
    self.invokeInterceptors(req.params.resource, 'delete.success', [ info, req, res, next ]);
    res.redirect('/admin/resources/' + req.params.resource);
  });
}, this); };


