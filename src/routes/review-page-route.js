const Apify = require('apify');

const { extractReviews } = require('../extraction/review-page-extraction');
const { addReviews, removeProcessedReviewUrl } = require('../global-store');
const { saveDetailIfComplete, validateProxy, setHtmlDebugValue } = require('../util');

const { log } = Apify.utils;
const { WebClient, ChatPostMessageArguments } =  require('@slack/web-api');

module.exports.handleReviewPage = async (context, globalContext) => {
    const {
        page,
        session,
        request: {
            url: reviewUrl,
            userData: { detailPagename },
        },
    } = context;
    const { input } = globalContext;

    const { startUrls, scrapeReviewerName = false } = input;
    const getBaseMessage = (slackChannel, review, color = '#0066ff') => ({
        channel: slackChannel,
        text:  `:white_check_mark: *New review received from ${detailPagename}* `,
        attachments: [
            {
                color,
                blocks: [
                    {
                        type: 'section',
                        fields: [
                            {
                                type: 'mrkdwn',
                                text: `*Author:* ${review.guestName}\n`,
                            },
                            {
                                type: 'mrkdwn',
                                text: `*Date:* ${review.date}\n`,
                            },
                            {
                                type: 'mrkdwn',
                                text: `*Score:* ${review.score}\n`,
                            },
                        ],
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": `*Positive:* ${review.positive}`,
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": `*Negative:* ${review.negative}`,
                        }
                    }
                ],
            },
        ],
    });

    await setHtmlDebugValue(page, 'REVIEW_PAGE');
    await waitForPageToLoad(page);

    await Apify.utils.puppeteer.injectJQuery(page);

    // Check if the page was opened through working proxy.
    validateProxy(page, session, startUrls, 'label');

    let reviews = await extractReviews(page);

    const token = "xoxb-5086549358049-5439419378340-7OYZXEemTmvm6YunucCgZJBu";
    const slackChannel= "reviews";
    //const token = "xoxb-5384634643063-5429247221827-IagETGnAj99DUVEQmdI5a4W5";
    //const slackChannel= "project";
    const color = '#00cc00';
    const slackClient = new WebClient(token);
    log.info("**********************   review   *************************");
    log.info(reviews);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 3);
    log.info(today);
    log.info(yesterday);

     reviews.map((review) => {
        const reviewDate = new Date(Date.parse(review.date));
        log.info(reviewDate);
        if(reviewDate >= yesterday && reviewDate <= today) {
            let slackMessage = getBaseMessage(slackChannel, review, color);
            const res = slackClient.chat.postMessage(slackMessage);
        }
     });
    // reviews.map((review) => {
    //     let slackMessage = getBaseMessage(slackChannel, review, color);
    //     const res = slackClient.chat.postMessage(slackMessage);
    // });
    /*let slackMessage = getBaseMessage(slackChannel, reviews, color);
    log.info(reviews);
    const res = slackClient.chat.postMessage(slackMessage);
    log.info(res);*/
    
    if (!scrapeReviewerName) {
        reviews = reviews.map((review) => {
            const reviewWithoutGuestName = { ...review };
            delete reviewWithoutGuestName.guestName;
            return reviewWithoutGuestName;
        });
    }

    addReviews(detailPagename, reviews);
    removeProcessedReviewUrl(detailPagename, reviewUrl);

    await saveDetailIfComplete(detailPagename);
};

const waitForPageToLoad = async (page) => {
    try {
        await page.waitForSelector('.c-review-block');
    } catch (e) {
        log.info('review info not found');
    }
};
