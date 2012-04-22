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
 *     - `entityViewTemplate` The template that will be used as view name to render entity reosources. {{singularName}} and {{pluralName}} can be used and will be substituted
 *     - `collectionViewTemplate` The template that will be used as view name to render collection reosources. {{singularName}} and {{pluralName}} can be used and will be substituted
 *     - `enableXhr` Enables a JSON interface for XMLHttpRequests. Make sure you don't leak important information!
 *     - `singleView` Whether there is a single view or not. If not, only the collection view will be used.
 * 
 * @param {Object} app The express app object to register the routes to.
 * @param {Object} options Options for this MongoRest instance
 * @param {Boolean} dontRegisterRoutes If you want to setup the routes manually
 */
var MongoRest = function(app, options, dontRegisterRoutes) {
  this.app = app;
  this.options = _.extend({
      urlPath: '/'
    , entityViewTemplate: 'resource_{{singularName}}'
    , collectionViewTemplate: 'resource_{{pluralName}}'
    , enableXhr: false
    , singleView: true
  }, options || {});
  // The resources for which there will be a rest interface
  this.resources = [ ];
  // Interceptors for specific events.
  this.interceptors = { };

  if (!dontRegisterRoutes) this.registerRoutes();
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
  this.app.all(this.options.urlPath + ':resourceName', this.collection());

  this.app.get(this.options.urlPath + ':resourceName', this.collectionGet());
  this.app.post(this.options.urlPath + ':resourceName', this.collectionPost());

  /**
   * Accessing single entities
   */ 
  // This makes sure the resource exists, and loads the model for the `get`, `put` and `delete` actions.
  this.app.all(this.options.urlPath + ':resourceName/id/:id', this.entity());

  this.app.get(this.options.urlPath + ':resourceName/id/:id', this.entityGet());
  this.app.put(this.options.urlPath + ':resourceName/id/:id', this.entityPut());
  this.app.delete(this.options.urlPath + ':resourceName/id/:id', this.entityDelete());
};

/**
 * Adds a model to be served as rest.
 * 
 * @param {String} singularName E.g.: `'user'`
 * @param {Object} model
 * @param {String} pluralName Optional, if the pluarl is not simply the singular with an s
 */
MongoRest.prototype.addResource = function(singularName, model, pluralName) {
  pluralName = pluralName || singularName + 's';
  if (pluralName === singularName) throw new Exception("The singular and plural name have to be different.");
  this.resources.push({ singularName: singularName, pluralName: pluralName, model: model });
};
 

/**
 * Returns a resource for a specific name
 * 
 * It checks the resources for singular and plural names!
 * 
 * @param  {String} name 
 * @return {Model} null if there is no such resource
 */
MongoRest.prototype.getResource = function(name) {
  return _.find(this.resources, function(resource) { return resource.pluralName === name || resource.singularName === name; });
};


/**
 * All interceptors are called with following parameters:
 * 
 *   - `info` For the parameters inside the info object please look at
 *            the post, put and delete methods.
 *   - `done` A function that has to be called as soon as the interceptor is done!
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
 * Every invoked interceptor **has to** call `done()` when it's finished processing.
 * 
 * The event `get-collection` is a special event that fires the `get` event for each document that has been fetched.
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

  // get-collection is a pseudo event which triggers the get event for each doc individually
  if (event === 'get-collection') event = 'get';

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
    if (realEvent !== 'get-collection') {
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
 * Parses a view template by replacing singular and plural names.
 * 
 * @param  {String} template 
 * @param  {Object} resource 
 * @return {String}
 */
MongoRest.prototype.parseViewTemplate = function(template, resource) {
  return template.replace("{{singularName}}", resource.singularName).replace("{{pluralName}}", resource.pluralName);
}

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
MongoRest.prototype.renderCollection = function(docs, req, res, next) {
  if (this.options.enableXhr && req.xhr) {
    res.send({ docs: docs });
  }
  else {
    res.render(this.parseViewTemplate(this.options.collectionViewTemplate, req.resource), { docs: docs, site: req.params.resourceName + '-list' });
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
  else res.render(this.parseViewTemplate(this.options.entityViewTemplate, req.resource), { doc: doc, site: req.params.resourceName + '-show' });
};





/**
 * All entities rest functions have to go through this first.
 * This function makes sure the resource is actually served, and
 * puts the right model in the req object
 *
 * @return {Function} The function to use as route
 */
MongoRest.prototype.collection = function() { return _.bind(function(req, res, next) {
  if (!(req.resource = this.getResource(req.params.resourceName))) { next(); return; }

  next();
}, this); };


/**
 * Renders a view with the list of all docs.
 * 
 * @return {Function} The function to use as route
 */
MongoRest.prototype.collectionGet = function() { return _.bind(function(req, res, next) {
  if (!req.resource) { next(); return; }

  var self = this;

  req.resource.model.find().sort('date', 'descending').run(function(err, docs) {
    if (err) {
      self.renderError(err, req, res, next);
      return;
    }
    else {

      var info = { docs: docs }
        , finish = function() { self.renderCollection(docs, req, res, next); };

      // That's not a real interceptor, it invokes the get interceptor for each doc.
      self.invokeInterceptors(req.params.resourceName, 'get-collection', info, req, res, next, finish);
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
  if (!req.resource) { next(); return; }
  var self = this;

  if (!req.body || !req.body.newResource) throw new Error('Nothing submitted.');

  var info = { values: req.body.newResource };

  this.invokeInterceptors(req.params.resourceName, 'post', info, req, res, next, function() {
    var doc = new req.resource.model(info.values);

    doc.save(function(err) {
      var event;
      info.doc = doc;
      if (err) {
        info.err = err;
        req.flash('error', 'Error: ' + err.message)
        event = 'post.error';
      }
      else {
        event = 'post.success';
      }
      self.invokeInterceptors(req.params.resourceName, event, info, req, res, next, function() {
        res.redirect(self.options.urlPath + req.params.resourceName);
      });
    });
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
  if (!(req.resource = this.getResource(req.params.resourceName))) { next(); return; }


  req.resource.model.findOne({ _id: req.params.id }, function(err, doc) {
    if (err) {
      req.flash('error', err.message);
      res.redirect(self.options.urlPath + req.params.resourceName);
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
  if (!req.resource) { next(); return; }

  var self = this
    , info = { doc: req.doc }
    , onFinish = function() {
        self.renderEntity(info.doc, req, res, next);
      };

  this.invokeInterceptors(req.params.resourceName, 'get', info, req, res, next, onFinish);
  
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
  if (!req.resource) { next(); return; }

  var self = this;
  if (!req.body || !req.body.newResource) throw new Error('Nothing submitted.');

  var info = { doc: req.doc, values: req.body.newResource };

  this.invokeInterceptors(req.params.resourceName, 'put', info, req, res, next, function() {
    _.each(info.values, function(value, name) {
      req.doc[name] = value;
    });

    req.doc.save(function(err) {
      var event;
      if (err) {
        info.err = err;
        event = 'put.error';
        req.flash('error', 'Unable to save the record: ' + err.message)
      }
      else {
        event = 'put.success';
        req.flash('success', 'Successfully updated the record.')
      }

      self.invokeInterceptors(req.params.resourceName, event, info, req, res, next, function() {
        res.redirect(self.options.urlPath + req.params.resourceName + (self.options.singleView ? '/id/' + req.doc._id : ''));
      });
    });
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
  if (!req.resource) { next(); return; }

  var info = { doc: req.doc }
    , self = this;

  this.invokeInterceptors(req.params.resourceName, 'delete', info, req, res, next, function() {
    req.doc.remove(function(err) {
      if (err) {
        info.err = err;
        self.invokeInterceptors(req.params.resourceName, 'delete.error', info, req, res, next, function() {
          next(err);
        });
      }
      else {
        self.invokeInterceptors(req.params.resourceName, 'delete.success', info, req, res, next, function() {
          res.redirect(self.options.urlPath + req.params.resourceName);
        });
      }
    });
  });
}, this); };


