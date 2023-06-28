const Apify = require('apify');
const { log } = Apify.utils;

module.exports.extractReviews = async (page) => {
    const extractedReviews = await page.evaluate(() => {
        const $ = window.jQuery;
        const extractReviewTexts = (reviewElement) => {
            const reviewTextElements = $(reviewElement).find('.c-review__inner--ltr');

            const reviewTexts = {
                positive: null,
                negative: null,
            };

            $(reviewTextElements).each((_index, element) => {
                const positive = $(element).find('.-iconset-review_great').length > 0;
                const negative = $(element).find('.-iconset-review_poor').length > 0;

                const reviewText = $(element).find('.c-review__body').text().trim() || null;
                if (reviewText) {
                    if (positive) {
                        reviewTexts.positive = reviewText;
                    } else if (negative) {
                        reviewTexts.negative = reviewText;
                    }
                }
            });

            return reviewTexts;
        };

        const extractReviewPhotos = (reviewElement) => {
            const LARGE_PHOTO_ATTRIBUTE = 'data-photos-large-src';
            const photoElements = $(reviewElement).find(`li.c-review-block__photos__item [${LARGE_PHOTO_ATTRIBUTE}]`);
            const photos = $.map(photoElements, (photoElement) => $(photoElement).attr(LARGE_PHOTO_ATTRIBUTE));
            return photos;
        };

        const extractCountryCode = (reviewElement) => {
            const COUNTRY_CODE_REGEX = /static\/img\/flags\/16\/([a-z]+)\//gi;
            const flagImage = $(reviewElement).find('.bui-avatar-block__flag img').attr('src');
            const countryCodeMatches = COUNTRY_CODE_REGEX.exec(flagImage) || [];
            const countryCode = countryCodeMatches.length > 1 ? countryCodeMatches[1] : null;
            return countryCode;
        };


        const reviewBlocks = $('.c-review-block');
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        console.log("**********************   Date   *************************");
        console.log(yesterday);
        console.log(today);
        const reviews = $.map(reviewBlocks, (el) => {
            // const dateMatches = $(el).find('.c-review-block__date').text().trim()
            //     .match(/([\d]{1,2}(.)+[\d]{4})/gi);
            const dateMatches = $(el).find('.c-review-block__date').text().trim();
            const datePortion = dateMatches.split(': ')[1]; // Extract the date portion after the colon
            const dateObject = new Date(Date.parse(datePortion));
            console.log("**********************   dateObject   *************************");
            console.log(dateObject);
            if (dateObject >= yesterday && dateObject < today) {
                const reviewTexts = extractReviewTexts(el);
                console.log("**********************   reviewTexts   *************************");
                console.log(reviewTexts);
                const review = {
                    title: $(el).find('.c-review-block__title').first().text()
                        .trim() || null,
                    score: parseFloat($(el).find('.bui-review-score__badge').text().trim()) || null,
                    ...reviewTexts,
                    guestName: $(el).find('.bui-avatar-block__title').text().trim(),
                    travellerType: $(el).find('.review-panel-wide__traveller_type .bui-list__body').text().trim(),
                    room: $(el).find('.c-review-block__room-info-row .bui-list__body').text().trim() || null,
                    nightsStay: parseInt($(el).find('.c-review-block__stay-date .bui-list__body').text().trim(), 10),
                    date: datePortion,
                    country: $(el).find('.bui-avatar-block__subtitle').text().trim(),
                    countryCode: extractCountryCode(el),
                    photos: extractReviewPhotos(el),
                };
                return review;
            }
        });

        return reviews;
    });

    return extractedReviews;
};
