import { load, Cheerio, AnyNode } from 'cheerio';
import axios from 'axios'

async function getPageData(keywork: string, cookie: string) {
  const pageData = await axios.get(`https://www.zmji.net/danci/${keywork}`, {
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "sec-ch-ua": "\"Google Chrome\";v=\"105\", \"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"105\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"macOS\"",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "upgrade-insecure-requests": "1",
      "cookie": cookie
    }
  })
  return pageData.data
}

export async function pageDataToTextList(pageData: string) {
  const $ = load(pageData)
  const textList = $('.jiyi.mx-1.zjxx2').map((i, el) => {
    let text = ''
    el.children.forEach((child) => {
      if (child.type === 'text') {
        text += child.data.replace(/\s|\n/g, '')
      }
    })
    return text
  })
  const res = textList.toArray().filter(_ => !!_)
  return res
}

export async function run(keywork: string, cookie: string) {
  const pageData = await getPageData(keywork, cookie)
  const textList = pageDataToTextList(pageData)
  return textList
}

run('leak', "")
