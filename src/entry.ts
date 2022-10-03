import * as Bob from "@bob-plug/core";
import { load, Cheerio, AnyNode } from 'cheerio';
import { Part, Phonetic } from './helper/types';
import { run, pageDataToTextList } from './main'

const baseUrl = 'https://dictionary.cambridge.org';

/**
 *
 * @param {object} query
 * @param {string} query.detectFrom = en; 一定不是 auto
 * @param {string} query.detectTo = "zh-Hans" 一定不是 auto
 * @param {string} query.from = auto 可能是 auto
 * @param {string} query.to = auto 可能是 auto
 * @param {string} query.text = "string"
 * @param {*} completion
 */
function translate(query, completion) {
    if (!query.text || query.text.split(" ").length > 2) {
        completion({
            error: {
                type: 'notFound',
            }
        });
        return;
    }
    let text = query.text

    // completion({
    //     result: {
    //         toParagraphs: [text]
    //     }
    // })

    Bob.api.$http.get({
        url: `https://www.zmji.net/danci/${text}`,
        header: {
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
            "cookie": "zmji2=userl=74b6d0613fc279c9cd9c4589781b901a; zmji=username=Chenng&userinfo=733a2bcd032b7dd5fdcddcb66084fdc9&userid=9580&zmjiinfo=74b6d0613fc279c9cd9c4589781b901a; Hm_lvt_f21aeb73e240d18ffbf1b16b4a91c446=1662738878,1662822785,1663112718,1663379938; Hm_lpvt_f21aeb73e240d18ffbf1b16b4a91c446=1664751445"
        },
        handler: (res) => {
            const textList = pageDataToTextList(res.data)

            // completion({
            //     result: {
            //         toParagraphs: [
            //             '离开(谐音):泄露*********************v.漏,泄漏n.漏洞,漏隙;泄漏,漏出Atthebreakfast,thesteakleakedfromthebreak.早餐时,肉片从缺口处漏出来.*********************v泄露；渗漏；n裂缝foolproof:fail＝airtight:leak极简单的防止出错＝密封的防止泄露"',
            //             '裂开→泄露→leakv.泄露；(使)漏n.漏洞，漏隙；泄漏，漏出量leak→立刻→有人泄露了秘密，我们要立刻补上这个漏洞'
            //         ]
            //     }
            // })
            
            completion({
                result: {
                    toParagraphs: textList
                }
            })

        }
    });
}
const addMap = (map: Map<string, string[]>, key: string, value: string) => {
    if (map.has(key)) {
        map.get(key)?.push(value);
    } else {
        map.set(key, [value]);
    }
}
const mapToParts = (map: Map<string, string[]>) => {
    const parts: Part[] = [];
    map.forEach((value, key) => {
        parts.push({
            part: key,
            means: value
        })
    })
    return parts;
}
const main = (file: any, completion) => {
    const pushPart = (parts, part, ...means) => {
        if (means) {
            parts.push({
                part: part.trim(),
                means: means.map(mean => mean.trim())
            })
        }
    }
    const $ = load(file);
    const word = $('.headword').first().text();
    const hasWord = $('.headword').html();
    Bob.api.$log.info(`word: ${word}`);
    let phonetics: Phonetic[] = []
    const partMap = new Map<string, string[]>();
    if (hasWord) {
        phonetics = [makePhonetic($('.us .pron .ipa'), $('.us [type="audio/mpeg"]'), 'us'), makePhonetic($('.uk .pron .ipa'), $('.uk [type="audio/mpeg"]'), 'uk')];
        // 英文释义、中文释义、例句
        Bob.api.$log.info(`phonetics${JSON.stringify(phonetics)}`);
        const parts: any[] = [];
        // 单词几个词性
        const explanationCnt = $('.entry-body__el').length;
        console.log('explanationCnt', explanationCnt);
        $('.entry-body__el').each((i, el) => {
            // 词性：名词、形容词等，anc-info-head为短语的时候词性classname
            const curPartSpeech = $('.posgram', el).text() || $('.anc-info-head', el).text();
            $('.dsense', el).each((index, element) => {
                const dBlock = $('.def-block', element).each((index, element) => {
                    const enExplanation = $('.ddef_h', element).text();
                    const cnExplanation = $('.ddef_b', element).children().first().text();
                    pushPart(parts, `${curPartSpeech}-英文释义`, enExplanation);
                    pushPart(parts, `${curPartSpeech}-中文释义`, cnExplanation);
                    addMap(partMap, curPartSpeech, cnExplanation);
                    let exampleCnt = 0;
                    let shouldPushEg = true;
                    $('.examp', element).each((index, element) => {
                        const enExample = $('.eg', element).text();
                        const cnExample = $('.eg', element).next().text();
                        if (shouldPushEg) {
                            pushPart(parts, `例句${index + 1}`, `${enExample}\n${cnExample}`)
                        }
                        exampleCnt++;
                        if (explanationCnt > 1 && exampleCnt >= 1) {
                            shouldPushEg = false;
                        }
                    })
                    shouldPushEg = true;
                });
            });
        })
        Bob.api.$log.info(`parts${parts}`);
        const res = {
            from: 'en',
            to: 'zh-Hans',
            fromParagraphs: [
                word
            ],
            toDict: {
                phonetics,
                additions: transformToAdditions(parts), // 把词义转化为additions结构增加可读性
                parts: mapToParts(partMap),
                word: word
            },
            raw: '',
            toParagraphs: [word],
        }
        completion({
            result: res
        });
        Bob.api.$log.info(`res${res}`);

    } else {
        completion({
            error: {
                type: 'notFound',
            }
        });
    }
}
const cache = new Bob.Cache();
const INSTALL = "__INSTALLED";

// transform parts to additions
const transformToAdditions = (parts: Part[]) => {
    return parts.map(part => {
        return {
            name: part.part,
            value: part.means.join(';')
        }
    })
}
const makePhonetic = ($textEl: Cheerio<AnyNode>, $audioEl: Cheerio<AnyNode>, type: string): Phonetic => {
    const value = $textEl.first().text() ?? '';
    const audio = $audioEl.attr('src');
    return {
        type,
        value,
        tts: audio ? {
            type: 'url',
            value: `${baseUrl}${audio}`
        } : undefined
    }
}

const buryPoint = (eventName) => {
    Bob.api.$http
        .post<{ status: 1 | 0 }>({
            url: "https://api.mixpanel.com/track?verbose=1&%69%70=1",
            header: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: {
                data: JSON.stringify([
                    {
                        event: eventName,
                        properties: {
                            token: "756388d6385bd7d3b849b18e4016c84a",
                            identifier: Bob.api.$info.identifier,
                            version: Bob.api.$info.version,
                        },
                    },
                ]),
            },
        })
        .finally(() => {
            cache.set(INSTALL, Bob.api.$info.version);
        });
};
const otherLang: Array<[string, string]> = [
    "af",
    "ar",
    "az",
    "bg",
    "bn",
    "bs",
    "cs",
    "da",
    "de",
    "el",
    "en",
    "es",
    "et",
    "fa",
    "fi",
    "fr",
    "gu",
    "he",
    "hi",
    "hr",
    "id",
    "it",
    "ja",
    "ka",
    "km",
    "kn",
    "ko",
    "lo",
    "lt",
    "lv",
    "mk",
    "ml",
    "mn",
    "mr",
    "ms",
    "my",
    "nl",
    "no",
    "pa",
    "pl",
    "pt",
    "ro",
    "ru",
    "sk",
    "sl",
    "sv",
    "ta",
    "te",
    "th",
    "tl",
    "tr",
    "uk",
    "ur",
    "vi",
    "ab",
    "sq",
    "ay",
    "ba",
    "bi",
    "nb",
    "ca",
    "cv",
    "eo",
    "ee",
    "fj",
    "lg",
    "kl",
    "ht",
    "tn",
    "ho",
    "iu",
    "ki",
    "kg",
    "kj",
    "lu",
    "mh",
    "ng",
    "nd",
    "os",
    "qu",
    "sm",
    "sg",
    "st",
    "nr",
    "ss",
    "ty",
    "tt",
    "ti",
    "to",
    "ts",
    "tk",
    "tw",
].map((e) => [e, e]);

const items: Array<[string, string]> = [["zh-Hans", "zh"], ["zh-Hant", "zh-Hant"], ...otherLang];
const langMap = new Map(items);
function supportLanguages() {
    return ['zh-Hans', 'zh-Hant','en'];
}
