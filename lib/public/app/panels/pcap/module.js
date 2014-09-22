/** @scratch /panels/5
 *
 * include::panels/pcap.asciidoc[]
 */

/** @scratch /panels/pcap/0
 * == pcap
 * Status: *Stable*
 *
 * The pcap panel is used for displaying static pcap formated as markdown, sanitized html or as plain
 * pcap.
 *
 */

 // declare global vars
var hexHighlightHelper = [];
var mapped_hex_data = [];

// load current pcap data
$.getScript("app/panels/pcap/packet_data.js");

define([
  'angular',
  'app',
  'lodash',
  'require',
  'jquery',
  'searchhighlight',
  'kbn'
],
function (angular, app, _, require, kbn) {
  'use strict';

  var module = angular.module('kibana.panels.pcap', []);
  app.useModule(module);

  module.controller('pcap', function($scope, $http, $rootScope, $modal, $q, $compile, $timeout, fields, querySrv, filterSrv, dashboard) {
    $scope.panelMeta = {
      status  : "Stable",
      description : "A static pcap panel that can use plain pcap, markdown, or (sanitized) HTML"
    };

    // Set and populate defaults
    var _d = {
      /** @scratch /panels/pcap/5
       *
       * === Parameters
       *
       * mode:: `html', `markdown' or `pcap'
       */
      mode    : "markdown", // 'html','markdown','pcap'
      /** @scratch /panels/pcap/5
       * content:: The content of your panel, written in the mark up specified in +mode+
       */
      content : "",
      queries : {
        mode: 'all',
        ids: []
      },
      style: {'font-size': '9px'},
    };
    _.defaults($scope.panel,_d);

    $scope.init = function() {
      $scope.ready = false;

      // $scope.$on('refresh',function(){$scope.get_data();}); //
      // $scope.get_data();
      //$scope.map_bytes();
    };

    // Show Second Level Details
    $scope.toggle_details = function(row) {
      row.details = row.details ? false : true;
      row.view = row.view || 'table';
    };

    $scope.setSelected = function(selectedValue) {
       $scope.selectedValue = selectedValue;
    };

    $scope.toggleDetail = function($index) {
        $scope.isVisible = $scope.isVisible == 0 ? true : false;
        $scope.activePosition = $scope.activePosition == $index ? -1 : $index;
    };

    // Highlight the 3rd Level Data
    $scope.highlight_text = function(row) {
      // TODO: Pass in the event/row
      // var val = $(this).val();
      var val = 'd4c3 b2a1 0200';
      var options = {
        exact: 'partial',
        style_name_suffix: false,
        keys: val
      }
      $(document).SearchHighlight(options);
    }

    $scope.protShowname = function(obj) {

    // console.log('*** protShowname ***');
      return obj.showname;
    }


    $scope.fieldvalShowname = function(val) {

    // console.log('*** fieldvalShowname ***');

      if (val.field) {
        var showname = "";
        for (var i = 0; i < val.field.length; ++i) {
          showname = showname + "<li>" + val.field[0].$.showname + "</li>";
        }
        return val.$.showname + "<ul>" + showname + "</ul>";
      }
      var start = parseInt(val.$.pos);
      var end = start + parseInt(val.$.size) - 1;

      return val.$.showname;
    }



    // Highlight the 3rd Level Data
    $scope.hightlight_bytes = function(parent) {
      // console.log('parent = ', parent);

      $("span").removeClass('selected').css('background-color','transparent');
      $("span[class^="+parent+"]").addClass('selected').css('background-color','blue');
    }

    $scope.highlight_bytes_below = function(pos, size) {
      //console.log('pos, size = ', pos, ',' , size);
      var end = parseInt(pos) + parseInt(size) - 1;
      var parentClass = [pos]+'_'+[end];

      console.log('parentClass = ', parentClass);
      var pclass = String("."+parentClass);
      $("span").removeClass('selected').css('background-color','transparent');
      $("span[class^="+parentClass+"]").addClass('selected').css('background-color','blue');
    }

    $scope.fieldBytes = function(val) {
      //console.log("fieldByte, pos = ", val.$.pos, ", size = ", val.$.size);
      //console.log("fieldByte, val = ", val);
    }

    $scope.spacing = function(val) {
      //console.log("fieldByte, val = ", val);
      if (val % 8 === 0) {
        if (val % 16 === 0) {
          return " <br>";
        }
        return " . ";
      }
    }

    // Create sample PCAP JSON object
    $scope.pcapData = {};

    $scope.data = [];

    $scope.packet_data = packet_data;

    //console.log('packet_data = ',packet_data);

    $scope.ipToHex = function (ip) {
      var parts = ip.split('.');
      for (var i = 0; i < parts.length; i++) {
        parts[i] = parseInt(parts[i]).toString(16);
      }
      return parts.join('');
    }

    // Get HBase PCAP data
    $scope.get_data = function(dashboard, segment, query_id) {

      var _segment, request, boolQuery, queries;
      var source_port = dashboard.current.pcap_settings.source_port;
      var dest_port = dashboard.current.pcap_settings.dest_port;
      // var source_ip = dashboard.current.pcap_settings.source_ip;
      // var dest_ip = dashboard.current.pcap_settings.dest_ip;
      // var protocol = dashboard.current.pcap_settings.protocol;

      var pcap_query = [];
      pcap_query.push(source_port, dest_port);
      console.log(pcap_query);

      if(dashboard.indices.length === 0) {
        return;
      }

      _segment = _.isUndefined(segment) ? 0 : segment;
      $scope.segment = _segment;

      request = $scope.ejs.Request(dashboard.indices[_segment]); // Request() provides methods generating request body

      // $scope.panel.queries.ids = querySrv.idsByMode($scope.panel.queries); // query goes here

      // queries = querySrv.getQueryObjs($scope.panel.queries.ids);
      queries = querySrv.getQueryObjs(pcap_query);
      // console.log(queries)

      boolQuery = $scope.ejs.BoolQuery();

      _.each(queries, function(q) {
        boolQuery = boolQuery.should(querySrv.toEjsObj(q));
      });

      request = request.query(
        $scope.ejs.FilteredQuery(
          boolQuery,
          $scope.panel.locked ? null : filterSrv.getBoolFilter(filterSrv.ids())
        ))
        .highlight(
          $scope.ejs.Highlight($scope.panel.highlight)
          .fragmentSize(2147483647));

      // $scope.populate_modal(request);

      request.doSearch().then(function(results) {
        if($scope.query_id === query_id) {
          $scope.data = $scope.data.concat(_.map(results.hits.hits, function(hit) {

            // _source.pcap_id
            var
              _h = _.clone(hit),
              _p = _.omit(hit,'_source','sort','_score');

            _h.kibana = {
              _source : _.extend(kbn.flatten_json(hit._source),_p),
              highlight : kbn.flatten_json(hit.highlight||{})
            };

          }));
        } else {
          return;
        }
        // console.log($scope.data)
      });

    };

  });

  module.directive('markdown', function() {
    return {
      restrict: 'E',
      link: function(scope, element) {
        scope.$on('render', function() {
          render_panel();
        });

        function render_panel() {
          require(['./lib/showdown'], function (Showdown) {
            scope.ready = true;
            var converter = new Showdown.converter();
            var pcap = scope.panel.content.replace(/&/g, '&amp;')
              .replace(/>/g, '&gt;')
              .replace(/</g, '&lt;');
            var htmlText = converter.makeHtml(pcap);
            element.html(htmlText);
            // For whatever reason, this fixes chrome. I don't like it, I think
            // it makes things slow?
            if(!scope.$$phase) {
              scope.$apply();
            }
          });
        }

        render_panel();
      }
    };
  });

  module.filter('newlines', function(){
    return function (input) {
      return input.replace(/\n/g, '<br/>');
    };
  });

  module.filter('striphtml', function () {
    return function(pcap) {
      return pcap
        .replace(/&/g, '&amp;')
        .replace(/>/g, '&gt;')
        .replace(/</g, '&lt;');
    };
  });

  module.filter('startFrom', function() {
        return function(input, start) {
            start = +start; //parse to int
            return input.slice(start);
        }
    });

  module.filter('num', function() {
    return function(input) {
      return parseInt(input, 10);
    }
  });


  module.directive('packet', function() {
    return {
      templateUrl: 'packet.html',
      scope: {
        packet: '='
      },
      link: function(scope, elm, attr) {
        scope.select = function(proto) {
          scope.selectedBytes = proto.$;
          // scope.selectedData = proto.$.uid;
          scope.selectedData2 = proto.$.name;
          // console.log('proto = ',proto);
          // console.log('scope.selectedBytes = ',scope.selectedBytes);
        };
        scope.select_field = function(field) {
          scope.selectedBytes = field.$;
          // scope.selectedData = field.$.uid;
          scope.selectedData2 = field.$;
          // console.log('field = ',field);
          // console.log('scope.selectedBytes = ',scope.selectedBytes);
        };

        scope.highlightMap = [];

        function uid(obj) {
          var temp_string = String(obj.showname);
          var temp_hash = (Math.random() + 1).toString(36).substring(7);//crypto.randomBytes(20).toString('hex');
          return temp_string + '_' + temp_hash;
        }

        //makes hexhighlighter array  with all fields mapped out with start,end and uid
        //creating a new hex highlight helper array -> hexHighlight
        scope.map_array = function(obj) {
          var start, end;
          obj.$.uid = uid(obj);

            for (var i = 0; i < obj.field.length; i++) {
              start = parseInt(obj.field[i].$.pos);
              end = start + parseInt(obj.field[i].$.size) - 1;
              obj.field[i].$.uid = uid(obj.field[i].$);

              if (obj.$.name != 'geninfo' && obj.field) {
                if (end >= start) {
                  hexHighlightHelper.push({
                    $: obj.field[i].$,
                    uid: obj.field[i].$.uid,
                    start: start,
                    end: end
                  });
                }
              }

            }
        };

        scope.get_end = function(obj) {
          // console.log('pos = ',obj.pos);
          // console.log('size = ',obj.size);
          // console.log('obj = ',obj);
          var start = parseInt(obj.pos);
          var end = start + parseInt(obj.size) - 1;
          // console.log('start = ',start);
          // console.log('end = ',end);
          if (end >= start) {
            return end;
          }
          else {
            return start;
          }
            return start;
        };

        scope.$watch('packet', function(value, oldValue) {
          scope.selectedData = {};
          scope.selectedData2 = {};
          hexHighlightHelper = [];
          if (value != oldValue) {
            $.each(value.proto, function(i, proto) {
              scope.map_array(proto);
            });
          }

        });
      }
    };
  });


  module.directive('hexBytes', function($timeout) {
    return {
      templateUrl: 'hexBytes.html',
      scope: {
        selectedData: '=',
        selectedBytes: '=',
        bytes: '='
      },
      link: function(scope, elm, attr) {
        scope.selectByte = function(offset) {
          //console.log('selectedData2 =',selectedData2);
          var selected = $.grep(hexHighlightHelper, function(obj) {
          if (obj.start <= offset && obj.end >= offset) {
              return true;
            }
          })[0];

          if (selected) {
            $.extend(scope.selectedData, selected);
            scope.selectedBytes = selected.$;
          }
        ;}
      }
    };
  });

  module.directive('pcapSettings', function() {
    return {
      templateUrl: 'pcapSettings.html',
      link: function(scope, elm, attr) {
        console.log('PCAP Settings Test')
      }
    }
  });

});


