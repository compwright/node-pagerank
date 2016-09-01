'use strict';

var cheerio = require('cheerio');
var url = require('url');

var PagerankLinkIndexer = function() {
	this.map = {};
	this.index = [];
};

var httpRegex = /^https?:\/\//i;

// Index the outbound hyperlinks contained in the document
function parseOutboundLinks(doc) {
	var pageUrl = doc.item.url,
		$ = cheerio.load(doc.body);

	return $('a[href]')
		.get() // array of nodes
		.map(function(node) {
			// Extract the link URL
			var href = $(node).attr('href');

			// Resolve relative URLs against the page URL
			return url.resolve(pageUrl, href);
		})
		.filter(function(resolvedUrl) {
			// Only return outbound URLs
			if (resolvedUrl == pageUrl) return false;

			// Only return http[s] URLs
			if (!httpRegex.test(resolvedUrl)) return false;

			return true;
		});
}

// Map each document URL to the document URLs it links to
PagerankLinkIndexer.prototype.push = function(doc) {
	var url = doc.item.url;
	if (this.index.indexOf(url) > -1) {
		throw 'Document already indexed: ' + url;
	} else {
		this.index.push(url);
		this.map[url] = parseOutboundLinks(doc);
	}
};

PagerankLinkIndexer.prototype.get = function(url) {
	return this.map[url] || [];
};

PagerankLinkIndexer.prototype.hasOutlink = function(url, outlink) {
	return (this.get(url).indexOf(outlink) > -1);
};

PagerankLinkIndexer.prototype.countOutlinks = function(url) {
	return this.get(url).length;
};

PagerankLinkIndexer.prototype.getAll = function() {
	return this.map;
};

PagerankLinkIndexer.prototype.getIndex = function() {
	return this.index;
};

PagerankLinkIndexer.prototype.sortIndex = function() {
	this.index = this.index.sort();
};

module.exports.PagerankLinkIndexer = PagerankLinkIndexer;


var sum = function(values) {
	return values.reduce(function(sum, current) {
		return sum + current;
	}, 0);
};

var subtract = function(V, W) {
	var difference = 0;

	for (var i = 0; i < V.length; i++) {
		difference = difference + Math.abs(V[i] - W[i]);
	}

	return difference;
};

// Thanks to http://www.cems.uvm.edu/~tlakoba/AppliedUGMath/other_Google/Wills.pdf
var applyGoogleTransform = function(S, alpha) {
	var matrix = [],
	    length = S.length;

	// G = αS + (1 − α)Av
	// 
	// where:
	//   S = PagerankMatrix
	//   A = column matrix of ones
	//   α = damping factor between 0 and 1 (typically 0.85)
	//   v = personalization vector of probabilities, sums to 1

	// Compute the second term using a shortcut: let
	// v = an equal probability distribution of 1/n.
	// Then A·v will produce an n×n uniform matrix, where
	// each value is 1/n. Thus, we only need to compute
	// the scalar value:
	//
	// (1 − α)(1 / n), or (1 − α) / n
	//
	var adjustment = (1 - alpha) / length;

	// Compute G
	var row, col;
	for (row = 0; row < length; row++) {
		matrix[row] = [];

		for (col = 0; col < length; col++) {
			matrix[row][col] = alpha * S[row][col] + adjustment;
		}
	}

	return matrix;
};

var PagerankMatrix = function(matrix) {
	this.matrix = matrix || [];
};

PagerankMatrix.prototype.asArray = function() {
	return this.matrix;
};

PagerankMatrix.prototype.loadFromIndex = function(pagerankLinkIndex) {
	var index = pagerankLinkIndex.getIndex(),
		length = index.length,
		matrix = [];

	// Produce a right stochastic matrix, where all values represent probabilities
	// between 0 and 1, and all row sums equal 1
	var row, col, x, y, rowSum;
	for (row = 0; row < length; row++) {
		matrix[row] = [];

		for (col = 0; col < length; col++) {
			x = index[row];
			y = index[col];

			// Compute the matrix columns. Wherever page x links to page y, fill in the
			// probability 1/N, where N is the number of all outbound links from x.
			// This represents the odds of the user clicking the outbound link to y
			// from x. If there is no outbound link to y, the probability is zero
			// (we don't count selflinks either, where x = y).
			if (row == col || !pagerankLinkIndex.hasOutlink(x, y)) {
				matrix[row][col] = 0;
			} else {
				matrix[row][col] = 1 / pagerankLinkIndex.countOutlinks(x);
			}
		}

		// A dangling node is any page with no outbound links to any page
		// (i.e. a row of zeros). Since the user may type the URL of any
		// of the pages, the probability of visiting page y is 1/D, where
		// D is the matrix dimension (length and width, or the number of
		// all indexed pages in the matrix). This transforms the matrix
		// into the Google matrix G, and maintains stochacity.
		if (sum(matrix[row]) == 0) {
			matrix[row].fill(1 / length);
		}
	}

	this.matrix = matrix;

	return this;
};

PagerankMatrix.prototype.calculatePageRank = function(alpha, epsilon, cb) {
	var G = applyGoogleTransform(this.matrix, alpha),
		length = this.matrix.length,
		cb = cb || function() {};

	var P = [], lastP = [];

	// Set initial PageRank vector value
	P.length = length;
	P.fill(1 / length);

	var error = 1, pr = 0, iteration = 0, i, j;
	while (error >= epsilon) {
		// Copy PageRank vector for error calculation
		lastP = P.slice();

		for (i = 0; i < length; i++) {
			pr = 0;
			for (j = 0; j < length; j++) {
				// Multiply each column by the PageRank vector
				pr = pr + (P[j] * G[j][i]);
			}
			P[i] = pr;
		}

		error = subtract(P, lastP);

		cb(iteration, P, error);

		iteration++;
	}

	return P;
};

module.exports.PagerankMatrix = PagerankMatrix;
