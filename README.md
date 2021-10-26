# @eligundry/gatsby-source-goodreads

Gatsby source that provides Goodreads shelf information.

## Why Use This?

There are many Gatsby Goodreads sources, why make another? It was fun AND all the sources I'm seeing are using the
Goodreads API which is due to be deprecated soon. This plugin scrapes for the publically accessible HTML available on
their website. Also, no need to fiddle with API keys to pull the data!

## Installation

```bash
$ npm install -S @eligundry/gatsby-source-goodreads
```

## Usage

In `gatsby-config.js`:

```javascript
module.exports = {
  plugins: [
    {
      resolve: '@eligundry/gatsby-source-goodreads',
      options: {
        userID: 123,
        shelves: ['currently-reading', 'read'],
      }
    }
  ]
}
```

Then, you can query it like so (this is what I'm using on my site):

```graphql
query UseGoodreadsShelves {
  currentlyReading: allGoodreadsBook(
    filter: { shelf: { eq: "currently-reading" } }
    sort: { fields: started, order: DESC }
    limit: 6
  ) {
    books: nodes {
      title
      author
      isbn
      url
      started
      coverImage {
        childImageSharp {
          gatsbyImageData(width: 175, quality: 90)
        }
      }
    }
  }
  recentlyFinished: allGoodreadsBook(
    filter: { shelf: { eq: "read" } }
    sort: { fields: finished, order: DESC }
    limit: 6
  ) {
    books: nodes {
      finished
      title
      author
      isbn
      url
      started
      coverImage {
        childImageSharp {
          gatsbyImageData(width: 175, quality: 90)
        }
      }
    }
  }
}
```
