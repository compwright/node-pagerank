'use strict';

function Crawler(options) {
	var self = this;

	if (options.url) {
		// https://github.com/cgiffard/node-simplecrawler
		self.crawler = new require('simplecrawler')(options.url);
	} else {
		throw 'options.url is required';
	}

	self.indexer = options.indexer || [];

	// Only index HTML files
	self.crawler.addDownloadCondition(function(queueItem, response) {
		return (
	        queueItem.stateData.contentType.substring(0, 9) === 'text/html'
	    );
	});

	self.crawler
		.on('crawlstart', function() {
		    console.info('Crawl started');
		})
		.on('complete', function() {
		    console.info('Crawl finished');
		})
		.on('fetchcomplete', function(queueItem, responseBuffer, response) {
			console.info('Crawling:', queueItem.url);
			self.indexer.push({
				item: queueItem,
				body: responseBuffer.toString('utf8'),
				response: response
			});
		});
}

Crawler.prototype.crawl = function() {
	var self = this;

	var p = new Promise(function(resolve, reject) {
		self.crawler.on('complete', function() {
		    resolve(self.indexer);
		});
	});

	self.crawler.start();

	return p;
};

module.exports = function(options) {
	return new Crawler(options);
};
