/**
 * Copyright reelyActive 2014-2019
 * We believe in an open Internet of Things
 */


const http = require('http');
const dgram = require('dgram');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Barnowl = require('barnowl');
const BarnowlReel = require('barnowl-reel');
const Barnacles = require('barnacles');
const BarnaclesSocketIO = require('barnacles-socketio');
const BarnaclesElasticsearch = require('barnacles-elasticsearch');
const Chickadee = require('chickadee');
const JSONSilo = require('json-silo');
const Raddec = require('raddec');
const Starling = require('starling');
const StatusManager = require('./statusmanager');
const ElasticManager = require('./elasticmanager');


const PORT = process.env.PORT || 3001;
const REEL_PORT = process.env.REEL_PORT || 50000;
const RADDEC_PORT = process.env.RADDEC_PORT || 50001;
const ELASTICSEARCH_NODE = process.env.ELASTICSEARCH_NODE;


const DEFAULT_USE_CORS = true;


/**
 * HLCServer Class
 * Serves up hyperlocal context (HLC) for the Internet of Things.
 */
class HLCServer {

  /**
   * HLCServer constructor
   * @param {Object} options The configuration options.
   * @constructor
   */
  constructor(options) {
    let self = this;
    options = options || {};

    if(!options.hasOwnProperty('useCors')) {
      options.useCors = DEFAULT_USE_CORS;
    }

    this.app = express();
    this.server = http.createServer(this.app);
    this.router = express.Router();
    this.app.use(bodyParser.json());
    this.app.use(function(req, res, next) {
      req.hlcserver = self;
      next();
    });
    this.app.use('/status', require('./routes/status'));
    this.app.use('/interfaces/elasticsearch',
                 require('./routes/interfaces/elasticsearch'));
    this.app.use('/', express.static(path.resolve(__dirname + '/../web')));
    this.app.use('/', this.router);

    if(options.useCors) {
      self.app.use(cors());
    }

    this.udpServer = dgram.createSocket('udp4');
    this.udpServer.bind(RADDEC_PORT, '0.0.0.0');

    this.elastic = new ElasticManager({ node: ELASTICSEARCH_NODE });
    this.status = new StatusManager();

    this.barnowl = new Barnowl(options.barnowl);
    this.barnowl.addListener(BarnowlReel, {}, BarnowlReel.UdpListener,
                             { path: '0.0.0.0:' + REEL_PORT });

    if(!options.hasOwnProperty('barnacles')) {
      options.barnacles = {};
    }
    options.barnacles.barnowl = this.barnowl;
    this.barnacles = new Barnacles(options.barnacles);
    this.barnacles.addInterface(BarnaclesSocketIO, { server: this.server });
    this.elastic.notifyOnElasticsearchRunning(function(client) {
      self.barnacles.addInterface(BarnaclesElasticsearch, { client: client });
      console.log('reelyActive hlc-server detected Elasticsearch node');
    });

    if(!options.hasOwnProperty('chickadee')) {
      options.chickadee = {};
    }
    options.chickadee.app = this.app;
    this.chickadee = new Chickadee(options.chickadee);

    if(!options.hasOwnProperty('jsonsilo')) {
      options.jsonsilo = {};
    }
    options.jsonsilo.app = this.app;
    this.jsonsilo = new JSONSilo(options.jsonsilo);

    if(!options.hasOwnProperty('starling')) {
      options.starling = {};
    }
    options.starling.app = this.app;
    this.emulator = new Starling(options.starling);
    this.emulator.on('raddec', function(raddec) {
      self.barnacles.handleRaddec(raddec);
    });

    this.udpServer.on('message', function(msg) {
      try {
        let raddec = new Raddec(msg);

        if(raddec !== null) {
          self.barnacles.handleRaddec(raddec);
        }
      }
      catch(error) {};
    });

    this.server.listen(PORT, function() {
      console.log('reelyActive hlc-server is listening on port', PORT);
    });
  }

  /**
   * Add the given hardware listener to barnowl.
   * @param {Class} interfaceClass The (uninstantiated) barnowl-x interface.
   * @param {Object} interfaceOptions The interface options as a JSON object.
   * @param {Class} listenerClass The (uninstantiated) listener class.
   * @param {Object} listenerOptions The listener options as a JSON object.
   */
  addListener(interfaceClass, interfaceOptions, listenerClass,
              listenerOptions) {
    this.barnowl.addListener(interfaceClass, interfaceOptions,
                             listenerClass, listenerOptions);
  }

  /**
   * Add the given interface to barnacles.
   * @param {Class} interfaceClass The (uninstantiated) barnacles-x interface.
   * @param {Object} interfaceOptions The interface options as a JSON object.
   */
  addInterface(interfaceClass, interfaceOptions) {
    this.barnacles.addInterface(interfaceClass, interfaceOptions);
  }

}


module.exports = HLCServer;
