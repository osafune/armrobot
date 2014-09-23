// ------------------------------------------------------------------- //
//  アームロボット操作サンプル                                         //
// ------------------------------------------------------------------- //

// PERIDOTオブジェクトを生成 
var myps = new Canarium();


//  パネルの初期化 

var select;
var btnconn;
var btnscan;
var confmes;

window.onload = function() {

	// スライダーの動作 
	document.getElementById('ch1').addEventListener('input', function() {
		iowrite(0x10001010, document.getElementById('ch1').value);
	}, false);
	document.getElementById('ch2').addEventListener('input', function() {
		iowrite(0x10001020, document.getElementById('ch2').value);
	}, false);
	document.getElementById('ch3').addEventListener('input', function() {
		iowrite(0x10001030, document.getElementById('ch3').value);
	}, false);
	document.getElementById('ch4').addEventListener('input', function() {
		iowrite(0x10001040, document.getElementById('ch4').value);
	}, false);
	document.getElementById('ch5').addEventListener('input', function() {
		iowrite(0x10001050, document.getElementById('ch5').value);
	}, false);
	document.getElementById('led').addEventListener('input', function() {
		var ledvalue = parseInt(document.getElementById('led').value * 25);
		myps.avm.iowr(0x10001000, 0, ledvalue, function(result) {} );
	}, false);

	// 停止ボタンの動作 
	document.getElementById('ch1stop').addEventListener('click', function() {
		document.getElementById('ch1').value = 0;
		iowrite(0x10001010, 0);
	}, false);
	document.getElementById('ch2stop').addEventListener('click', function() {
		document.getElementById('ch2').value = 0;
		iowrite(0x10001020, 0);
	}, false);
	document.getElementById('ch3stop').addEventListener('click', function() {
		document.getElementById('ch3').value = 0;
		iowrite(0x10001030, 0);
	}, false);
	document.getElementById('ch4stop').addEventListener('click', function() {
		document.getElementById('ch4').value = 0;
		iowrite(0x10001040, 0);
	}, false);
	document.getElementById('ch5stop').addEventListener('click', function() {
		document.getElementById('ch5').value = 0;
		iowrite(0x10001050, 0);
	}, false);


	// ウィンドウのオブジェクトを取得 
	select = document.getElementById('ports');
	btnconn = document.getElementById('connect');
	btnscan = document.getElementById('scanport');
	confmes = document.getElementById('configstatus');

	// 初期化 
	btnconn.addEventListener('click', connectPort, false);
	btnscan.addEventListener('click', portarea_set, false);
	portarea_set();
}


// PERIDOTボードの接続と切断 
var onConnect = false;

function connectPort() {
	if (!onConnect) {
		var selectedPort = select.childNodes[select.selectedIndex].value;
		portarea_set("WAITING");
		confmes.innerHTML = "通信ポートを開いています...";

		myps.open(selectedPort, function (result) { if (result) {

			// PERIDOTコンフィグレーション 
			var rbf = new sample_armrobot_top_rbf();

			confmes.innerHTML = "PERIDOTボードをコンフィグレーションしています...";

			myps.config(0, rbf, function (result) { if (result) {
				qsys_init(myps, function (result) { if (result) {
					onConnect = true;
					portarea_set("READY");
					confmes.innerHTML = "PERIDOTボードに接続しました";

				} else {
					myps.close(function () {
					portarea_set("ERROR");
					confmes.innerHTML = "PERIDOTボードとの通信ができません";
					});

				} });
			} else {
				myps.reset(function (result, respbyte) {
					if (result && (respbyte & (1<<0))!= 0) {
						myps.close(function () {
						portarea_set("ERROR");
						confmes.innerHTML = "スイッチをPS側に切り替えてください";
						});

					} else {
						myps.close(function () {
						portarea_set("ERROR");
						confmes.innerHTML = "PERIDOTボードがコンフィグレーションできません";
						});
					}
				});
			} });
		} else {
			portarea_set("ERROR");
			confmes.innerHTML = "PERIDOTボードに接続できません";
		} });

	} else {
		myps.close(function () {
		onConnect = false;
		portarea_set("CLOSE");
		});
	}
}


// シリアルポートエリアの有効化・無効化 
function portarea_set(flag) {
	var wicon = document.getElementById('waitingicon');

	// シリアルポートの取得 
	var rescanport = function() {
		btnscan.disabled = true;

		chrome.serial.getDevices(function (ports) {
			// エレメントを全て削除 
			while(select.firstChild) select.removeChild(select.firstChild);

			// スキャン結果を追加 
			for (var i=0; i<ports.length; i++) {
				var port = ports[i].path;
				select.appendChild(new Option(port, port));
			}

			// 選択できるポートがあるか 
			if (select.firstChild) {
				btnconn.disabled = false;
			} else {
				btnconn.disabled = true;
			}

			btnscan.disabled = false;
		});
	};

	// 各オブジェクトの状態を変更 
	switch(flag) {
	case "READY" :
		select.disabled = true;
		btnscan.disabled = true;
		btnconn.disabled = false;
		btnconn.value="切断";
		wicon.src="img/icon_ok_24x24.png";
		break;

	case "CLOSE" :
		select.disabled = false;
		btnscan.disabled = false;
		btnconn.disabled = false;
		btnconn.value="接続";
		wicon.src="img/dummy_1x1.png";
		confmes.innerHTML = "";
		break;

	case "ERROR" :
		select.disabled = false;
		btnscan.disabled = false;
		btnconn.disabled = false;
		btnconn.value="接続";
		wicon.src="img/close03-001-24.png";
		break;

	case "WAITING" :
		select.disabled = true;
		btnscan.disabled = true;
		btnconn.disabled = true;
		wicon.src="img/loading02_r2_c4.gif";
		break;

	case "PAUSE" :
		select.disabled = true;
		btnscan.disabled = true;
		btnconn.disabled = true;
		break;

	case "RESTART" :
		btnconn.disabled = false;
		if (!onConnect) {
			select.disabled = false;
			btnscan.disabled = false;
		}
		break;

	default :
		if (!onConnect) {
			btnconn.value = "接続";
			rescanport();
		}
		break;
	}
}


// Qsysシステムの初期化 
function qsys_init(canarium_obj, callback) {
	var dev = canarium_obj;

	// ボードIDの読み出し 
//	dev.getinfo( function() {

	// ファーストアクノリッジ設定 
	dev.avm.option({fastAcknowledge:true}, function() {

	// sysIDを読み出す 
	var qsys_systemid_address = (0x10000000 >>> 0);
	dev.avm.iord(qsys_systemid_address, 0, function(result, iddata) { if (result) {
	dev.avm.iord(qsys_systemid_address, 1, function(result, tmdata) { if (result) {

	console.log("qsys : sysid = 0x" + ("00000000" + iddata.toString(16)).slice(-8) + 
			", 0x" + ("00000000" + tmdata.toString(16)).slice(-8) );

	callback(true);
	} else { callback(false); } });
	} else { callback(false); } });

	});
//	});
}

// アームレジスタへ書き込み 
function iowrite(address, value) {
	var io_voltage = 3.3;
	var max_voltage = 2.5;
	var min_voltage = 1.0;
	var voltage_step = (max_voltage - min_voltage) / 10;

	var ctrl = 0;
	var speed = 0;

	if (value < 0) {
		ctrl = 1;
		speed = -value;
	} else if (value > 0) {
		ctrl = 2;
		speed = value;
	}

	var datavalue = parseInt((speed * voltage_step + min_voltage) * 255 / io_voltage);

	myps.avm.iowr(address, 0, (ctrl<<8) | datavalue, function(result) {} );
}


