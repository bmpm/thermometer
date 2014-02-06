var adapterPath = null;
var bus = null;

function addHeaderList(header, spin, list, ulId) {
  var devListContainer = document.getElementById(list);
  var item = document.createElement("header");

  item.appendChild(document.createTextNode(header));
  if (spin != null) {
    var spinItem = document.createElement("progress");
    spinItem.id = spin;
    spinItem.style.marginLeft = "15px";
    spinItem.style.marginBottom = "10px";
    item.appendChild(spinItem);
  }
  devListContainer.appendChild(item);

  var devList = document.createElement("ul");
  devList.id = ulId;
  devListContainer.appendChild(devList);

  return devList;
}

function clearAllList(list) {
  listView = document.getElementById(list);

  while (listView.hasChildNodes()) {
      listView.removeChild(listView.lastChild);
  }
}

function errorCB(error) {
  console.log("error: " + error + "\n");
}

function successPairCB(path, msg) {
  console.log(msg);
  delItemList("discovery" + path);
  customConfirm("Result", msg, "");
}

function callPairDevice(path, alias, paired) {
  console.log("Pair device: " + path + ", paired: " + paired);

  var obj = bus.getObject("org.bluez", path, null, errorCB);

  if (paired == 0) {
    console.log("Attempting to pair with " + alias);
    obj.callMethod("org.bluez.Device1", "Pair", []).then(
        function () { successPairCB(path, "Device " + alias + " : " + "Pairing successful"); },
        function (error) { errorPairCB(error, "Failed to pair: " + alias); });
  }
  else {
    console.log("Already paired, attempting to connect with " + alias);
    obj.callMethod("org.bluez.Device1", "Connect", []).then(
        function () { successPairCB(path, "Device " + alias + " : " + "Connection successful"); },
        function (error) { errorPairCB(error, "Failed to connect: " + alias); });
  }
}

function addItemList(properties, ulItem, path) {
  var devList = document.getElementById(ulItem);
  var devItem = document.createElement("li");

  devItem.setAttribute("data-name", properties["Alias"]);
  devItem.id = "discovery" + path;

  devItem.addEventListener("click", function (e) {
    console.log("Pair to device (clicked): " + this.getAttribute("data-name"));

    callPairDevice(path, this.getAttribute("data-name"), properties["Paired"]);
  });

  var devA = document.createElement("a");
  var devP = document.createElement("p");
  var devTitle = document.createTextNode(properties["Alias"]);

  devP.appendChild(devTitle);
  devA.appendChild(devP);
  devItem.appendChild(devA);
  devList.appendChild(devItem);
}

function delItemList(item) {
  var node = document.getElementById(item);

  if (node == null)
    return;

  node.parentNode.removeChild(node);
}

function interfacesAdded(path, interfaces) {
  console.log("Interface added: " + path);

  if (interfaces == null)
    return;

  var properties = interfaces["org.bluez.Device1"];

  if (properties == null)
    return;

  console.log("[ " + properties["Address"] + " ]");
  addItemList(properties, "dev-disc-list-ul", path)
}

function interfacesRemoved(path, interfaces) {
  console.log("Interface removed: " + path);

  if (document.querySelector('#dev-discovery').className == 'current') {
      delItemList("discovery" + path);
  } else if (document.querySelector('#remove-device').className == 'current') {
      delItemList("remove" + path);
  } else
      delItemList(path);
}

function connectSuccess() {
  bus = cloudeebus.SystemBus();
  console.log("Connected to cloudeebus");

  bus.getObject("org.bluez", "/",
      function (proxy) {
        proxy.connectToSignal("org.freedesktop.DBus.ObjectManager", "InterfacesAdded", interfacesAdded, errorCB);
        proxy.connectToSignal("org.freedesktop.DBus.ObjectManager", "InterfacesRemoved", interfacesRemoved, errorCB);
        proxy.GetManagedObjects().then(getDevices, errorCB); },
      function (error) { console.log("Device list: " + error); });
}

function connect() {
  cloudeebus.connect("ws://localhost:9000", null, connectSuccess, errorCB);
}

function callRemoveDevice() {
}

function customConfirm(title, msg, type) {
  document.getElementById("conf-title").innerHTML = title;
  document.getElementById("conf-name-disc").innerHTML = msg;
  document.getElementById("conf-button").className = type;

  document.querySelector('#confirm').className = 'fade-in';
}

function rebuildDevList() {
  bus.getObject("org.bluez", "/",
    function (proxy) { proxy.GetManagedObjects().then(getDevices, errorCB); },
    function (error) { console.log("Device list: " + error); });
}

function setEnabledItem(id, value) {
  var item = document.getElementById(id);

  if (item == null)
    return;
  item.setAttribute("aria-disabled", value);
}

function propertiesChanged(iface, changed, invalidated) {
  if (iface != "org.bluez.Device1")
    return;

  console.log("PropertiesChanged: " + iface + ", Name: " + this.Alias);

  if (changed["Connected"] == null)
    return;

  if (changed["Connected"] == 0) {
    customConfirm("WARNING", "Device " + this.Alias + " disconnected", "danger");
    setEnabledItem(this.objectPath, "true");
  } else
    setEnabledItem(this.objectPath, "false");
}

function getDevices(objs) {
  clearAllList("dev-list");

  var devList = addHeaderList("Available Devices (Paired)", null, "dev-list", "dev-list-ul");

  for (o in objs) {

    if (adapterPath == null && objs[o]["org.bluez.Adapter1"] != null) {
      console.log("Adapter: " + o);
      adapterPath = o;
    }

    if (objs[o]["org.bluez.Device1"] == null)
      continue;

      // Ignore temporary devices
      if (objs[o]["org.bluez.Device1"]["Paired"] == 0)
        continue;

      console.log("Device paired: " + objs[o]["org.bluez.Device1"]["Alias"]);
      bus.getObject("org.bluez", o,
        function (proxy) { proxy.connectToSignal("org.freedesktop.DBus.Properties",
                          "PropertiesChanged", propertiesChanged, errorCB); },
        function (error) { console.log("Properties changed handler: " + error); });


      var devItem = document.createElement("li");
      devItem.setAttribute("data-name", objs[o]["org.bluez.Device1"]["Alias"]);
      devItem.id = o;
      if (objs[o]["org.bluez.Device1"]["Connected"] == 0)
        devItem.setAttribute("aria-disabled", "true");
      devItem.addEventListener("click", function (e) {
          console.log("Clicked device: " + this.getAttribute("data-name"));

          // FIXME: call thermometer value window
      });

      var devA = document.createElement("a");
      var devP = document.createElement("p");
      var devTitle = document.createTextNode(objs[o]["org.bluez.Device1"]["Alias"]);

      devP.appendChild(devTitle);
      devA.appendChild(devP);
      devItem.appendChild(devA);
      devList.appendChild(devItem);
  }
}

function getTMPDevices(objs) {
  for (o in objs) {
    if (objs[o]["org.bluez.Device1"] == null)
      continue;

    // Get temporary devices and not connect devices (already paired)
    if (objs[o]["org.bluez.Device1"]["Connected"] == 1)
      continue;

    console.log("Device discovery: " + objs[o]["org.bluez.Device1"]["Alias"] +
                ", path: " + o);
    addItemList(objs[o]["org.bluez.Device1"], "dev-disc-list-ul", o);
  }
}

function createDiscList() {
  clearAllList("dev-disc-list");
  addHeaderList("Devices Found", "spin-dev-disc", "dev-disc-list", "dev-disc-list-ul");
  document.querySelector('#btn-stop-disc').innerHTML = "STOP";

  bus.getObject("org.bluez", "/",
    function (proxy) { proxy.GetManagedObjects().then(getTMPDevices, errorCB); },
    function (error) { console.log("Device discovery list: " + error); });
}
