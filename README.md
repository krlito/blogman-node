#Blogman

Blogman is an easy-to-use blog engine made for node.js platform. You only need to write your 
articles/posts in markdown, put them in the posts folder and blogman will process them to be shown 
on your website.

This module is intended to be used in personal developers blogs. A working example can be seen in 
[my blog][carlos-blog]. This blog engine is in alpha state because it still does not have all the 
desired features. Anyway, it is fully operational as it is right now.


##Requirements

Blogman depens on [filemonitor-node], which depends on [inotify-tools]. To install inotify-tools 
on a Linux (Debian/Ubuntu) system:

    sudo apt-get install inotify-tools

For installing on other linux flavors, go [here][getting-inotify-tools].


##Installation

Once [inotify-tools] is installed. On your project directory:

    npm install blogman


##Usage

Blogman has two operation modes as described in the following sub-sections.


### Express integration mode

For using blogman with [express], you just configure it passing the express application object.
Also, you can pass an optional settings object as it is shown in the next example. Any setting not
set in the settings object will take a default value. Default values are the same shown in the
example, e.g. default `encoding` value is "utf8".

```javascript
    var express = require('express'),
      blogman = require('blogman'),
      app = express.createServer();

    //... some express configuration code

    //Routes

    blogman.configure(app, {
      route: "/blog",
      blogdir: "./blog/",
      encoding: "utf8",
      postsPerPage: 5
    });
    //app.get...
    //Other routes
```

If you want to use default setting values, you could just invoke `blogman.configure(app);`.
In the example, full method arguments were used for demostration purposes.


#### So what blogman does is...

Assuming you use default settings as in the previous example. Postman will capture two routes:
- GET http://yoursite/blog(/:page)?
- GET http://yoursite/blog/post/:id

The first route is for showing your post list in a paginated way. The number of posts shown 
per page is defined by property `postsPerPage`. The second route will be used for accessing 
an specific article. For rendering these pages, blogman will use `blog` and `blogpost` 
views in your express project. These two views MUST exist.

Blogman will look for markdown files in the `./blog/posts/` folder. These files will be read 
using the defined encoding. They will be parsed and processed so they can be shown when they are
requested.

A blogman example markdown file format is:

    title: My First Post
    author: John Doe
    date: 01 May 2011 16:30:00 -0500

    This is my first post for blogman blog engine.
    
    Here there is another paragraph.

As you can see, blogman markdown files should have a special header with metadata for the post. 
It is recommended to use at least these three properties (`title`, `author` and `date`). Anyway, 
you could set any property you desire in the header like `keywords` or `location`. Header goes 
from the beginning of the file until the first blank line is found.

Notes:
- `date` is a very important property because posts are ordered using this criteria. Be careful 
to use a valid javascript date string format as in the example. 
- There is an `id` property which uniquely identifies a post. It is set to be the filename
without `.markdown` extension. Do NOT declare this property inside the file.
- Each time an article file is put in the `./blog/posts` folder, it will be added to the 
website without doing anything else.


#### To render...

As stated previously, renderization is done using views `blog` and `blogpost` of the express 
project. `blog` is used when a list of posts is to be rendered and `blogpost` is used when only 
one post is going to be shown. In the latter case, the view will receive an object called `post`
with all the properties in the header of the post. `post` also have a `content` property with 
the HTML of the post content. If using jade, a view could be like this:

```jade
    .blog-post
     .blog-post-title
       h2= post.title
       p by <b>#{post.author}</b> on #{post.date}
     .blog-post-content
       != post.content
```

For the `blog` view (list of posts) case, you will receive a `posts` array. Then, you could do:

```jade
    .content-title
      h1 Blog Articles
    .blog-list
      each post in posts
        .blog-li
          .blog-li-title
            h2
              a(href='/blog/post/#{post.id}')= post.title
            small= post.date
          .blog-li-preview
            != post.preview
          a.btn.btn-primary(href='/blog/post/#{post.id}') Read more...
    .pagination.pagination-centered
      ul
        - for(var i=1; i <= posts.pageCount; i++)
          if i!==posts.page
            li
              a(href='/blog/#{i}')= i
          else
            li.active
              a= i
```

In this example, you can see `posts` array has a `page` property to indicate the current page. 
Also, each element of the array has a `preview` which is an HTML fragment of the full post content.


### Post/Article manager mode

In this mode, you can configure Blogman passing `null` instead of an application object. In this
case Blogman interface exposes methods `post(:id, callback(err, post))` and
`posts(:page, callback(err, posts)` which will respectively return one and many posts objects so
you can use them as you like. This objects are the same that would be passed to the views in the
*express integration mode*.

```javascript
    var blogman = require('blogman');
    blogman.configure(null);
    
    blogman.post('welcome', function(err, postData) {
      if(err) { return; };
      console.log(postData.title);
      console.log(postData.content);
    });
```

##ToDo
As stated previously, Blogman in in alpha stage. Features planned to be added soon are:
- Automatic syntax highlighting.
- Support for comments. 
- Support for RSS.
- Better layouts/views management support.

[carlos-blog]: http://campo.com.co/blog
[filemonitor-node]: http://github.com/krlito/filemonitor-node
[inotifywait]: http://github.com/rvoicilas/inotify-tools/wiki
[inotify-tools]: http://github.com/rvoicilas/inotify-tools/wiki
[express]: http://github.com/visionmedia/express/ 
[getting-inotify-tools]: http://github.com/rvoicilas/inotify-tools/wiki/#wiki-getting
