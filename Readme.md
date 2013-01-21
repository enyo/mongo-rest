# MongoREST Version 3.0.3-dev

![Build status](https://travis-ci.org/enyo/mongo-rest.png)

This is an [express][] [node][] [module][node modules] to provide basic [REST][] support to
access [mongodb][] [documents][mongodb documents] via [mongoose][].


[express]: http://www.expressjs.com/
[node]: http://www.nodejs.org
[node modules]: http://nodejs.org/api/modules.html
[REST]: http://en.wikipedia.org/wiki/Representational_state_transfer
[mongodb]: http://www.mongodb.org
[mongodb documents]: http://www.mongodb.org/display/DOCS/Documents
[mongoose]: http://www.mongoosejs.com



I use [semantic versioning][] and my [tag script][] to tag this module.

The library is fully tested with the [mocha test framework][] and the [should assertion
library][]. If you contribute please make sure that you write tests for it.


[semantic versioning]: http://semver.org/
[tag script]: https://github.com/enyo/tag
[mocha test framework]: http://visionmedia.github.com/mocha/
[should assertion library]: https://github.com/visionmedia/should.js


The latest **stable** version is always in the `master` branch. The `develop` branch is
cutting edge where tests regularely won't completely pass. Only checkout the `develop` branch
if you want to contribute.


## Installation

With npm:

    npm install mongo-rest

Or simply download the lates version from here, and put it in `node_modules/mongo-rest`.


## Usage

The usage of this module is quite straight forward:

1. Include and instantiate `mongo-rest`.
2. Provide `mongo-rest` with the [mongoose models][mongoose model] you want to support.
3. Create a view file for each resource you want rendered as HTML.
4. Optionally you can also define interceptors in case you want some resources to be handled exceptionally.

That's it, you're done.


### 1. Including and instantiating mongo-rest

MongoREST exposes a class you instatiate with your options. The long version looks like this:

```js
var MongoRest = require('mongo-rest')
  , mongoRest = new MongoRest(app, { ...options... });
```

The options for MongoRest are:

- `pathPrefix` The path prefix for the rest resources. Default to `/`
- `entityViewTemplate`
  The template that will be used as view name to render entity resources.
  `{{singularName}}` and `{{pluralName}}` can be used and will be substituted
- `collectionViewTemplate`
  The template that will be used as view name to render collection resources.
  `{{singularName}}` and `{{pluralName}}` can be used and will be substituted
- `entityDataName`
  The name that will be used in the JSON or in the template model. Defaults to
  `'{{singularName}}'`.
  So a JSON might look like this:
  ```json
  {
    "user": {
      "username": "bla"
    }
  }
  ```
- `collectionViewTemplate`
  The name that will be used in the JSON or in the template model. Defaults to
  `'{{pluralName}}'`.
  So a JSON might look like this:
  ```json
  {
    "users": [
      { "username": "bla" },
      { "username": "bla" }
    ]
  }
  ```
- `enableXhr` Enables a JSON interface for XMLHttpRequests. **Make sure you don't leak important information!**
- `singleView` Whether there is a single view or not. If not, only the collection view will be used.

As a one liner it looks like this:

```js
var mongoRest = new (require('mongo-rest'))(app, options);
```

When instantiated, MongoREST registers the routes with the `app` so that all REST routes
become accessible. If you provided `'/resources/'` as `pathPrefix` then following urls will
become alive for the `user` resource:

    GET: /resources/users (Renders a list of all users)
    POST: /resources/users (Creates a new user)

    GET: /resources/user/12345 (Renders the user with ID 12345)
    PUT: /resources/user/12345 (Updates the user with ID 12345)
    DELETE: /resources/user/12345 (Deletes the user with ID 12345)


> **Note:** `/user` and `/users` are always both valid. So you can always access
> your records on the plural or singular URLs. It's up to you.

### 2. Adding a mongoose model as resource

To tell `mongo-rest` which resources it should support you simple add each [mongoose model].
Normally you do this in the same place you define your routes. The code is quite straight
forward:

```js
mongoRest.addResource('user', require('../models/user'));
// And you can pass options:
mongoRest.addResource('hobby', require('../models/user'), {
  pluralName: 'hobbies', // for irregular plurals
  sort: "name username -birthdate", // Default sorting
  // And all class options can be used here to be overriden for this resource:
  entityViewTemplate: "my_cool_template",
  collectionViewTemplate: "my_awesome_records_template",
  enableXhr: false,
  singleView: true
});
```

That's it. Now MongoREST nows that it has to use those models whenever the resources `users`
or `hobbies` are accessed.



### 3. Create your views

When you access `/resources/users` for example, MongoREST will try to render
this list. To do this it will need a template files.

Two template files are needed for each resource to...

  1. ...render a list of the resource
  2. ...render a single resource

To define where the views are located you specify the `entityViewTemplate` and the
`collectionViewTemplate` options. If you pass `resources/{{singularName}}` as
`entityViewTemplate` and `resources/{{pluralName}}` as `collectionViewTemplate` then
MongoREST will use `resources/user` as view to render a single entity, and `resources/users`
to render a collection.


### 4. Create interceptors (Optional)

Sometimes some actions need to be taken before or after inserting, updating or deleting records.

You register an interceptor like this:

```js
var eventName = 'post.success'
  , handler = function(info, done, req, res, next) { /* Do stuff */ done(); };

mongoRest.addInterceptor('user', eventName, handler);
// You can also provide the same handler for multiple event names:
mongoRest.addInterceptor('users', [ 'post', 'put' ], handler);
```

The available event names are:

  - `get` Called when a resource is retrieved.
  - `post`, `post.success`, `post.error` Called when a new resource is posted.
  - `put`, `put.success`, `put.error` Called when a resource is updated.
  - `delete`, `delete.success`, `delete.error` Called when a resource is deleted.

If you simply use the event name without `.success` or `.error` it will be called **before**
the event will be carried out.

The parameters provided to the handler are:

  - `info` An object containing the `doc` and or the `values` that will be used to update the record
  - `done` A callback that **has to be called** as soon as the interceptor is finished handling the event.
           (this allows for asynchronous interceptors).
           If there was an error during the execution of an interceptor, call this function with
           the `err` object as first parameter. The invokation of the other interceptors will
           be canceled (if possible).
  - `req`
  - `res`
  - `next`


An example of an interceptor could look like this:

```js
/**
 * Intercepts posts and puts for guestbook-messages. It compiles the provided textSource with jade, and stores
 * the old textSource in a textVersions array to provide a history.
 */
mongoRest.addInterceptor('guestbook-message', [ 'post', 'put' ], function(info, done) {
  // Compile the new textSource value with jade, and put the compiled code in textHtml
  info.values.textHtml = (jade.compile(info.values.textSource))({});
  // Since there is no existing doc when posting a new resource, we test if it exists...
  if (info.doc) {
    // ...and if it does we add the old textSource to the textVersions array to have a history.
    info.doc.textVersions.push(info.doc.textSource);
  }
  // Tell mongoRest that the interceptor finished intercepting the request.
  done();
});
```

## XMLHttpRequests

Mongo-REST supports XMLHttpRequest, but since it could be a security risk, they are disabled by default.
If you want to enable them simply pass the option `enableXhr`.

The responses from Mongo-REST for XMLHttpRequests are always JSON and look like this:

```js
// If everything went right for entities:
{ user: doc }
// If everything went right for collections:
{ users: docs }
// If the server would normally redirect:
{ redirect: "some/url" }
// and if there was an error
{ error: "There was a problem." }
```

Note that `error` and `redirect` can be submitted simultaniously.


## License

(The MIT License)

Copyright (c) 2012 Matias Meno &lt;m@tias.me&gt;

Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the 'Software'), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.


[mongoose model]: http://mongoosejs.com/docs/model-definition.html