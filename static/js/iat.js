$(function(window, undefined) {
  /**
   * Timer for measuring user input speed.
   * It's a self-correcting timer to compense for the latency
   * induced by depending upon CPU time (which itself is
   * dependant on its current load).
   *
   * @see http://www.sitepoint.com/creating-accurate-timers-in-javascript/
   */
  var Timer = (function() {
    var startTime = new Date().getTime();
    var time = 0;
    var elapsed = 0;
    var timer = null;

    // Process calculations with auto-correction.
    var instance = function() {
      time += 100;
      elapsed = (time / 100) / 10;
      var diff = (new Date().getTime() - startTime) - time;
      window.setTimeout(instance, (100 - diff));
    }.bind(this);

    // Starts the timer.
    var start = function() {
      if (startTime === null) {
        startTime = new Date().getTime();
      }

      time = 0;
      elapsed = 0;
      timer = window.setTimeout(instance, 100);
    }.bind(this);

    // Stops the timer.
    var stop = function() {
      startTime = null;
      clearTimeout(timer);
    }.bind(this);

    // Return elpased time.
    var getElapsed = function() {
      return elapsed;
    };

    // Public API.
    return {
      start: start,
      stop: stop,
      getElapsed: getElapsed,
    };
  })();

  window.IAT = (function(window, undefined) {
    /**
     * Reference to UI pieces manipulated via jQuery.
     */
    var $uiCategoryLeft = $('.left'),
        $uiCategoryRight = $('.right'),
        $uiStimuli = $('.stimuli'),
        $uiWrongAnswerCross = $('.wrong-answer');
    /**
     * Update text on UI - left and right category, stimuli word.
     * @param  {Object} data Trial data.
     * @return {void}
     */
    function updateUIText(data) {
      $uiCategoryLeft.html(data.left);
      $uiCategoryRight.html(data.right);
      $uiStimuli.html(data.stimuli);
    }

    /**
     * Display big red cross for wronf answer.
     *
     * @param  {boolean} shouldDisplay
     * @return {void}
     */
    function displayWrongAnswerFeedback(shouldDisplay) {
      if (shouldDisplay) {
        $uiWrongAnswerCross
          .css('display', 'block')
          .animate({opacity: 1}, 200);
      } else {
        $uiWrongAnswerCross
          .animate({opacity: 0}, 500, function() {
            $uiWrongAnswerCross.css('display', 'none');
          });
      }
    }

    /**
     * Generate a batch of processed data from the raw JSON node.
     *
     * @param  {Object} data Raw JSON node of data for the block.
     * @return {Array} Stack of data to be processed in order.
     */
    function generateUnorderedData(data) {
      return data.categories_stimuli.map(function(catStim, i) {
        return {
          index: i,
          category: catStim.category,
          stimuli: catStim.stimuli
        };
      });
    }

    /**
     * Map the unordered data using the defined sequence order.
     *
     * @param  {Array}  stimuliSequence Sequence order, pattern of 0 (left) and 1 (right).
     * @param  {Array}  unorderedData   Array of objects to pick from.
     * @param  {String} Name of the block.
     * @return {Array}  A stack of objects usable for displaying trials.
     *                  The resulting array has a length equal to that of `stimuliSequence`.
     */
    function generateOrderedData(stimuliSequence, unorderedData, name) {
      return stimuliSequence.map(function(seq) {
        var source = unorderedData[seq];
        var item = source.stimuli.shift();
        var result = {
          correctCategory: source.category,
          stimuli: item,
          left: unorderedData[0].category,
          right: unorderedData[1].category,
          correctPosition: seq === 0 ? 'left' : 'right',
          blockName: name
        };
        source.stimuli.push(item);
        return result;
      });
    }

    /**
     * Generate batch of processed data from raw JSON nodes of "extras".
     *
     * @param  {String} name          Name of the block.
     * @param  {Object} frameCatStimA First object of `categories_stimuli` array of the frame.
     * @param  {Object} frameCatStimB Second object of `categories_stimuli` array of the frame.
     * @param  {Object} extrasCatStim Object of `categories_stimuli` array of the extra.
     * @param  {Array}  stimSeqA      Stimuli sequence for the first order.
     * @param  {Array}  stimSeqB      Stimuli sequence for the second order.
     * @return {Array}  Array containing two arrays: first order and second order of usable trials.
     */
    function generateExtrasData(name, frameCatStimA, frameCatStimB, extrasCatStim, stimSeqA, stimSeqB) {
      var mixA = {
        name: name,
        categories_stimuli: [
          {
            category: frameCatStimA.category + '+' + extrasCatStim.category,
            stimuli: extrasCatStim.stimuli.concat(frameCatStimA.stimuli)
          },
          {
            category: frameCatStimB.category + '+' + extrasCatStim.category,
            stimuli: frameCatStimB.stimuli
          }
        ]
      };

      var mixB = {
        name: name,
        categories_stimuli: [
          {
            category: frameCatStimB.category + '+' + extrasCatStim.category,
            stimuli: extrasCatStim.stimuli.concat(frameCatStimB.stimuli)
          },
          {
            category: frameCatStimA.category + '+' + extrasCatStim.category,
            stimuli: frameCatStimB.stimuli
          }
        ]
      };

      var orderA = generateOrderedData(
        stimSeqA, generateUnorderedData(mixA), mixA.name
      );

      var orderB = generateOrderedData(
        stimSeqB, generateUnorderedData(mixB), mixB.name
      );

      return [orderA, orderB];
    }

    /**
     * Prepare the processed, usable trials.
     *
     * @param  {Object} data Raw JSON data.
     * @return {Array}  The ready-to-use, stack of trial objects.
     */
    function prepareTrials(data) {
      var trials = [];

      // For each "frame", you get a block, i.e. a set of trials fed by "extras".
      data.frames.forEach(function(frame) {
        // So you start with a practice round of trials based on the frame only...

        // Prepare the data using the available stimuli.
        var unorderedData = generateUnorderedData(frame);
        trials = trials.concat(
          generateOrderedData(frame.stimuli_sequence, unorderedData, frame.name)
        );

        // Now "extras" will generate two new blocks each.
        data.extras.forEach(function(extra) {
          var name = extra.name + '+' + frame.name;
          var extrasData = generateExtrasData(
            name,
            frame.categories_stimuli[0],
            frame.categories_stimuli[1],
            extra.categories_stimuli[0],
            extra.stimuli_sequence_left,
            extra.stimuli_sequence_right
          );
          trials = trials.concat(extrasData[0], extrasData[1]);
        });
      });

      return trials;
    }

    /**
     * Load up and start the queue of trials, one after the next,
     * then return the results as a promise.
     *
     * @param  {Array}  dataStore
     * @return {Object} A promise resolving with the results payload.
     */
    function loadBlocks(dataStore) {
      var deferred = $.Deferred();

      startTrial(prepareTrials(dataStore))
        .then(function(results) {
          return deferred.resolve(results);
        });

      return deferred.promise();
    }

    function startTrial(queue) {
      var deferred = $.Deferred();

      deferred.resolve(queue);

      return deferred.promise();
    }

    /**
     * Public API.
     */
    return {
      begin: function(data) {
        return loadBlocks(data);
      }
    }
  })(window, undefined);

}(window, undefined));
