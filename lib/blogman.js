/*!
* blogman-node
* Copyright(c) 2012 Carlos Campo <carlos@campo.com.co>
* MIT Licensed
*/

//Dependencies
var fs = require('fs'),
  dirutils = require('./dirutils'),
  mem = require('./memcache'),
  filemon = require('filemonitor'),
  async = require('async'),
  showdown = new (require('showdown').Showdown).converter();

//Options
var blogDir, //Main blog directory
  encoding, //Files encoding
  postsPerPage, //Number of blog posts per page
  route; //Route to blog in the URL

//Private variables
var postsDir, //Articles directory
  viewsDir, //Views Dir
  cacheDir, //Post-processed posts directory
  blogView, //View to render blog post list
  postView, //View to render blog post
  postsMeta = []; //Post-processed posts basic metadata (post id, filenames, modification time)

// PUBLIC EXPORTS //
var blogman = exports;

/*
 * Configure this blogman instance
 */
blogman.configure = function (app, opts) {

  //Setup Configuration
  if(opts && typeof opts.route === "string") {
    route = opts.route;
  } else {
    route = "/blog";
  }

  if (opts && typeof opts.encoding === "string") {
    encoding = opts.encoding;
  } else {
    encoding = "utf8";
  }

  if (opts && typeof opts.postsPerPage === "number") {
    postsPerPage = opts.pageSize;
  } else {
    postsPerPage = 5;
  }
  
  if (opts && typeof opts.blogDir === "string") {
    blogDir = opts.blogdir.trim() + "/";
  } else {
    blogDir = "./blog/";
  }

  
  postsDir = blogDir + "posts/";
  viewsDir = blogDir + "views/";
  cacheDir = blogDir + ".cache/";
  blogView = "blog";
  postView = "blogpost";

  //Setup connect/express routes
  if(app) {
    app.use(require('express').static(__dirname + postsDir));

    app.get(route + '(?:/:page)?', function(req, res) {
      blogman.posts(parseInt(req.params.page, 10) || 1, function (err, posts) {
        res.render(blogView, { section: 'blog', posts: posts });
      });
    });

    app.get(route + '/post/:id', function(req, res, next) {
      blogman.post(req.params.id, function (err, post) {
        if(err === 404) {
          res.statusCode = 404;
          next();
        } else {
          res.render(postView, { section: 'blog', post: post });
        }
      });
    });
  }

  //Load data and start file monitoring
  init();
};

/*
 * Retrieve an post given its id.
 */
blogman.post = mem.cached(function (id, callback) {
  if(!postsMeta[id]) {
    if (callback) { process.nextTick(function () { callback(404); }); }
    return;
  }

  fs.readFile(cacheDir + postsMeta[id].cacheFilename, encoding, function (err, data) {
    if (err) { 
      if (callback) { process.nextTick(function () { callback(err); }); }
      return;
    }
    var postData = JSON.parse(data);
    if (callback) { process.nextTick(function () { callback(null, postData); }); }
  });
});

/*
 * Retrieve all posts in a page. posts(page, callback)
 */
blogman.posts = mem.cached(function () {
  var page = arguments.length > 1 ? parseInt(arguments[0], 10) : 1,
    callback = arguments[arguments.length - 1];

  async.map(
    postsMeta.slice((page - 1) * postsPerPage, page * postsPerPage),
    function (postMeta, callback2) { blogman.post(postMeta.id, callback2); },
    function (err, postsData) { 
      postsData.page = page;
      postsData.pageCount = blogman.pageCount();
      if (callback) { callback(err, postsData); }
    }
  );
});

/*
 * Returns number of posts
 */
blogman.postCount = function () {
  return postsMeta.length;
};

/*
 * Returns number of pages
 */
blogman.pageCount = function () {
  return Math.ceil(postsMeta.length / postsPerPage);
};


// PRIVATE FUNCTIONS //

/*
 * Start blogman automatic post processing + Load data
 */
function init(callback) {
  dirutils.buildDir(viewsDir);

  dirutils.buildDir(postsDir, function() {
    filemon.watch({
      target: postsDir,
      listeners: {
        modify: onArticleCreation,
        moved_from: onArticleDeletion,
        moved_to: onArticleCreation,
        create: onArticleCreation,
        remove: onArticleDeletion
      }
    });

    dirutils.buildDir(cacheDir, function() {
      async.series([
        loadArticlesMeta,
        syncArticlesMeta
        ], callback);
    });
  });
};

/*
 * Initialize postsMeta from existing diles in cacheDir
 */
function loadArticlesMeta(callback) {
  dirutils.ls(cacheDir, /.*\.json$/i, true, function (err, cacheFilenames) {
    if (err) { process.nextTick(function () { callback(err); }); return; }

    cacheFilenames.reverse();
    cacheFilenames.forEach(function (cacheFilename) {
      var match = cacheFilename.match(/(.*?)\.(.*?)\.(.*)\.json$/i),
        meta = {
          id: match[3],
          cacheFilename: cacheFilename,
          mtime: parseInt(match[2], 10),
          pos: postsMeta.length
        };

      postsMeta.push(meta);
      postsMeta[meta.id] = meta;
    });

    process.nextTick(function () { callback(null); });
  });
}

/*
 * Synchronize ArticlesMeta to reflect changes since last time blogman was run
 */
function syncArticlesMeta(callback) {
  dirutils.ls(postsDir, /.*\.markdown$/i, true, function (err, postsFilenames) {

    if (err) { process.nextTick(function () { callback(err); }); return; }
    var it = 0, it_end = postsMeta.length, jt = 0, jt_end = postsFilenames.length,
      postsFileInfo, idSortedArticlesMeta;

    postsFileInfo = postsFilenames.map(function (postFilename) {
      var match = postFilename.match(/(.*)\.markdown$/i);
      return {id: match[1], name: postFilename};
    });

    //postsFileInfo sorted by post id
    postsFileInfo.sort(function (a, b) {
      return a.id.localeCompare(b.id);
    });

    //postsMeta sorted by post id
    idSortedArticlesMeta = postsMeta.slice(0);
    idSortedArticlesMeta.sort(function (a, b) {
      return a.id.localeCompare(b.id);
    });

    //Loop to find differences between cached posts and posts in postsDir
    while (it < it_end && jt < jt_end) {
      if (idSortedArticlesMeta[it].id === postsFileInfo[jt].id) {
        syncArticlesMetaCompareStats(idSortedArticlesMeta[it], postsFileInfo[jt].name);
        it++;
        jt++;
      } else if (idSortedArticlesMeta[it].id <= postsFileInfo[jt].id) {
        filemon.trigger({
          filename: (postsDir + idSortedArticlesMeta[it].id + ".markdown"),
          eventId: "remove"
        });
        it++;
      } else {
        filemon.trigger({
          filename: (postsDir + postsFileInfo[jt].name),
          eventId: "create"
        });
        jt++;
      }
    }

    while (it < it_end) {
      filemon.trigger({
        filename: (postsDir + idSortedArticlesMeta[it].id + ".markdown"),
        eventId: "remove"
      });
      it++;
    }

    while (jt < jt_end) {
      filemon.trigger({
        filename: (postsDir + postsFileInfo[jt].name),
        eventId: "create"
      });
      jt++;
    }

  });
}

/*
 * syncArticlesMeta auxiliary function to compare last modification time
 */
function syncArticlesMetaCompareStats(cacheArticleMeta, postFilename) {
  fs.stat(postsDir + postFilename, function (err, stats) {
    if (err) { process.nextTick(function () { console.error(err); }); return; }

    if (cacheArticleMeta.mtime !== stats.mtime.getTime()) {
      filemon.trigger({
        filename: (postsDir + postFilename),
        eventId: "modify"
      });
    }
  });
}

/*
 * Listener called when an post is changed
 */
function onArticleChange(ev) {
  if (/(.*)\.markdown$/i.test(ev.filename)) {
    onArticleDeletion(ev);
    onArticleCreation(ev);
  }
}

/*
 * Listener called when a new post is created
 */
function onArticleCreation(ev) {
  var match = ev.filename.match(/(?:.*\/)*(.*)\.markdown$/i);
  if (!ev.isDir && match) {
    debugger;
    fs.readFile(ev.filename, encoding, function (err, data) {
      if (err) { console.error(err); return; }
      var id = match[1], post = {id: id};

      match = data.match(/^(\w+):\s*(.*)\s*/);
      while (match) {
        post[match[1].toLowerCase()] = match[2];
        data = data.substr(match[0].length);
        match = data.match(/^(\w+):\s*(.*)\s*/);
      }
      
      post.content = showdown.makeHtml(data);
      
      match = post.content.match(/((?:(?:.|\n)*?<p>(?:.|\n)*?<\/p>){1,2})/im);
      if(match) {
        post.preview = match[1] ;
      } else {
        post.preview = "<i>No preview available...</i>"
      }
      
      fs.stat(ev.filename, function (err, stats) {
        if (err) { console.error(err); return; }
        debugger;
        var cacheFilename = formatDateForFilename(new Date(post.date))
          + "." + stats.mtime.getTime()
          + "." + id + ".json";
        
      fs.writeFile(cacheDir + cacheFilename, JSON.stringify(post), encoding, function (err) {
          debugger;
          if (err) { console.error(err); return; }
          var i = 0, pMeta;

          pMeta = {
            id: id,
            cacheFilename: cacheFilename,
            mtime: stats.mtime.getTime(),
          };

          //'new' file is already in memory?
          if (postsMeta[id]) {
            pMeta.pos = postsMeta[id].pos; 
            if(postsMeta[id].cacheFilename !== pMeta.cacheFilename) {
              fs.unlink(cacheDir + postsMeta[id].cacheFilename);
            }

            postsMeta[pMeta.pos] = pMeta;
            postsMeta[pMeta.id] = pMeta;

            blogman.post.memremove(id);

          } else { 
            while (i < postsMeta.length && postsMeta[i].cacheFilename > cacheFilename) { i++; }
            pMeta.pos = i;

            postsMeta.splice(i, 0, pMeta);
            postsMeta[id] = pMeta;

            i++;
            while (i < postsMeta.length) {
              postsMeta[i].pos++;
              i++;
            }

            blogman.posts.memclear();
          }
        });
      });
    });
  }
}

/*
 * Listener called when an post is deleted
 */
function onArticleDeletion(ev) {
  var match = ev.filename.match(/(?:.*\/)*(.*)\.markdown$/i), i, id;
  if (!ev.isDir && match) {
    id = match[1];

    fs.unlink(cacheDir + postsMeta[id].cacheFilename);
    for (i = postsMeta[id].pos + 1; i < postsMeta.length; i++) {
      postsMeta[i].pos--;
    }

    postsMeta.splice(postsMeta[id].pos, 1);
    postsMeta[id] = null;

    blogman.post.memremove(id);
    blogman.posts.memclear();
  }
}

/*
 * Returns a formatted Date. The format is YYYYmmddHHMMSS
 */
function formatDateForFilename(d) {
  function pad(n) { return n < 10 ? '0' + n : n; }
  return d.getUTCFullYear()
    + pad(d.getUTCMonth() + 1)
    + pad(d.getUTCDate())
    + pad(d.getUTCHours())
    + pad(d.getUTCMinutes())
    + pad(d.getUTCSeconds());
}
