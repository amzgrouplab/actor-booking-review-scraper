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
        text:  ":white_check_mark: * New review received",
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
                            {
                                type: 'mrkdwn',
                                text: `*Positive:* ${review.positive}\n`,
                            },
                            {
                                type: 'mrkdwn',
                                text: `*Negative:* ${review.negative}\n`,
                            },
                        ],
                    },
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

    const token = "xoxb-5384634643063-5429247221827-IagETGnAj99DUVEQmdI5a4W5";
    const slackChannel= "project";
    const color = '#00cc00';
    const slackClient = new WebClient(token);
    log.info("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$slackClient");
    log.info(slackClient);
    let slackMessage = getBaseMessage(slackChannel, reviews, color);
    log.info(slackMessage);
    const res = slackClient.chat.postMessage(slackMessage);
    log.info(res);
    
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
