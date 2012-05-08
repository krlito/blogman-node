/*!
* fn-memcache-node
* Copyright(c) 2012 Carlos Campo <carlos@campo.com.co>
* MIT Licensed
*/

// PUBLIC EXPORTS //

exports.cached = function (fn) {
  var memcache = {},
    queue = {};

  //Cached function
  var cachedfn = function () {
    var key, callback = arguments[arguments.length - 1];

    key = Array.prototype.slice.call(arguments, 0, -1);
    key = key.join(":");

    if (memcache[key]) {
      process.nextTick(function () { callback.apply(this, memcache[key]); });
    } else if (queue[key]) {
      queue[key].push(callback);
    } else {
      queue[key] = [callback];

      arguments[arguments.length - 1] = function (err) {
        var args = arguments;

        queue[key].forEach(function (callback) {
          process.nextTick(function () { callback.apply(this, args); });
        });
        queue[key] = null;

        if(!err) { memcache[key] = arguments; }
      };

      fn.apply(this, arguments);
    }
  };

  //Remove a key from memcache
  cachedfn.memremove = function () {
    var key =  Array.prototype.join.call(arguments, ":");

    process.nextTick(function () {
      if (memcache[key]) { memcache[key] = null; }
    });
  };

  //Clear memcache
  cachedfn.memclear = function () {
    process.nextTick(function () { memcache = {}; });
  };

  return cachedfn;
};
