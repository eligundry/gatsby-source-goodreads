import axios, { AxiosResponse } from 'axios'
import { JSDOM } from 'jsdom'
import trim from 'lodash/trim'
import { GatsbyNode, SourceNodesArgs } from 'gatsby'
import {
  createRemoteFileNode,
  CreateRemoteFileNodeArgs,
} from 'gatsby-source-filesystem'

export interface GatsbySourceGoodReadsOptions {
  userID: string
  shelves: string[]
}

export const pluginOptionsSchema: GatsbyNode['pluginOptionsSchema'] = ({
  Joi,
}) => {
  return Joi.object({
    userID: Joi.string()
      .required()
      .description(
        'The ID of the user in GoodReads, can be found in a url like: https://www.goodreads.com/user/show/29665939-eli-gundry (29665939 is the ID)'
      ),
    shelves: Joi.array()
      .items(Joi.string())
      .description(
        'Shelves to be fetched from GoodReads. Examples are currently-reading, read, want-to-read'
      ),
  })
}

export const createSchemaCustomization: GatsbyNode['createSchemaCustomization'] =
  ({ actions }) => {
    actions.createTypes(
      `
      type GoodreadsBook implements Node {
        title: String
        author: String
        isbn: String
        isbn13: String
        asin: String
        pages: Int
        published: Date
        started: Date
        finished: Date
        cover: String
        coverImage: File @link
        url: String
        shelf: String
      }
      `
    )
  }

// @ts-ignore
export const sourceNodes: GatsbyNode['sourceNodes'] = async (
  args,
  options: GatsbySourceGoodReadsOptions
) => {
  const { createNodeId, createContentDigest } = args
  const { createNode } = args.actions

  for (const shelf of options.shelves) {
    let goodreadsHTML: AxiosResponse<string> | null

    try {
      goodreadsHTML = await axios.get<string>(
        `https://www.goodreads.com/review/list/${options.userID}`,
        {
          params: {
            ref: 'nav_mybooks',
            shelf,
            per_page: 100,
          },
        }
      )
    } catch (e) {
      console.error('could not fetch Goodreads shelf', e)
      return
    }

    const { document: goodreadsDocument } = new JSDOM(goodreadsHTML.data).window

    await Promise.all(
      Array.from(
        goodreadsDocument.querySelectorAll('#booksBody .bookalike')
      ).map(async (row) => {
        const cover = row
          ?.querySelector('td.field.cover img')
          ?.getAttribute('src')
          // Get the full sized thumbnail
          ?.replace(/\._\w+\d+_/, '')

        const urlPath = row
          ?.querySelector('td.field.cover a')
          ?.getAttribute('href')

        if (!cover || !urlPath) {
          return
        }

        const book = {
          title: customTrim(
            row?.querySelector('td.field.title a')?.getAttribute('title')
          ),
          author: customTrim(
            row?.querySelector('td.field.author .value')?.textContent
          ),
          isbn: customTrim(
            row?.querySelector('td.field.isbn .value')?.textContent
          ),
          isbn13: customTrim(
            row?.querySelector('td.field.isbn13 .value')?.textContent
          ),
          asin: customTrim(
            row?.querySelector('td.field.asin .value')?.textContent
          ),
          pages: parseInt(
            customTrim(
              row?.querySelector('td.field.num_pages .value')?.textContent
            ) || '0'
          ),
          published: getDateField(row, 'td.field.date_pub .value'),
          started: getDateField(
            row,
            'td.field.date_started .date_started_value'
          ),
          finished: getDateField(row, 'td.field.date_read .date_read_value'),
          cover,
          coverImage: null,
          url: urlPath ? `https://www.goodreads.com${urlPath}` : null,
          shelf,
        }

        const imageNode = await loadImage({
          cacheKey: `local-goodreads-cover-${book.isbn}`,
          url: book.cover,
          createNode,
          ...args,
        })

        book.coverImage = imageNode.id

        createNode({
          id: createNodeId(`goodreads-book-${book.isbn}`),
          parent: null,
          children: [],
          internal: {
            type: 'GoodreadsBook',
            content: JSON.stringify(book),
            contentDigest: createContentDigest(book),
          },
          ...book,
        })
      })
    )
  }
}

const trimChars = '\n *'

const getDateField = (row: Element, selector: string): Date | null => {
  const rawDate = row.querySelector(selector)?.textContent

  if (rawDate) {
    return new Date(trim(rawDate, trimChars))
  }

  return new Date('2000-01-01')
}

const customTrim = (value: string | undefined | null): string | null =>
  value ? trim(value, trimChars) : null

type LoadImageArgs = CreateRemoteFileNodeArgs &
  SourceNodesArgs & {
    cacheKey: string
  }

const loadImage = async (args: LoadImageArgs) => {
  const { cacheKey, cache, ...createRemoteFileNodeArgs } = args

  if (cacheKey) {
    const cachedImage = await cache.get(cacheKey)

    if (cachedImage && cachedImage.fileNodeID) {
      return cachedImage
    }
  }

  const imageNode = await createRemoteFileNode({
    cache,
    ...createRemoteFileNodeArgs,
  })

  if (imageNode && cacheKey) {
    await cache.set(cacheKey, {
      fileNodeID: imageNode.id,
      modified: imageNode.modifiedTime,
    })
  }

  return imageNode
}
