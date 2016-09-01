'use strict';

var crawlerFactory = require('./crawler');
var PagerankLinkIndexer = require('./pagerank').PagerankLinkIndexer;
var PagerankMatrix = require('./pagerank').PagerankMatrix;

if (process.argv.length < 3) {
    console.log('Usage: node index.js mysite.com');
    process.exit(1);
}

var crawler = crawlerFactory({
	url: process.argv[2],
	indexer: new PagerankLinkIndexer()
});

crawler.crawl().then(function(index) {
	index.sortIndex();
	   
	var alpha = 0.85,
	    epsilon = 0.000001,
	    matrix = new PagerankMatrix(),
	    iterations = 0;

	matrix.loadFromIndex(index);
	var P = matrix.calculatePageRank(alpha, epsilon, function() {
		iterations++;
	});

	var pages = index.getIndex(),
	    rankedPages = [],
	    roundingFactor = Math.round(1 / epsilon);

	for (var i = 0; i < pages.length; i++) {
		rankedPages.push({
			url: pages[i],
			pageRank: Math.round(P[i] * roundingFactor) / roundingFactor
		});
	}

	rankedPages = rankedPages.sort(function(a, b) {
		// sort in descending order
		return b.pageRank - a.pageRank;
	});

	console.log('Iterations:', iterations);
	console.log('PageRank values:');
	console.log(rankedPages);
});
