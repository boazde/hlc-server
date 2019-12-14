const Barnowl = require('barnowl');
const BarnowlReel = require('barnowl-reel'); // 1: Include the interface 
//package

 
let barnowl = new Barnowl();
 
barnowl.on("raddec", function(raddec) {
  console.log(raddec);
});
 
barnowl.addListener(BarnowlReel, {}, BarnowlReel.SerialListener, { path: 
"auto" });

//barnowl.addListener(Barnowl, {}, Barnowl.TestListener, {});



