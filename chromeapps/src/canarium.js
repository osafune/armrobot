// ------------------------------------------------------------------- //
//  PERIDOT Chrome Package Apps Driver - 'Canarium.js'                 //
// ------------------------------------------------------------------- //
//
//  ver 0.9.5
//		2014/08/20	s.osafune@gmail.com
//
// ******************************************************************* //
//     Copyright (C) 2014, J-7SYSTEM Works.  All rights Reserved.      //
//                                                                     //
// * This module is a free sourcecode and there is NO WARRANTY.        //
// * No restriction on use. You can use, modify and redistribute it    //
//   for personal, non-profit or commercial products UNDER YOUR        //
//   RESPONSIBILITY.                                                   //
// * Redistributions of source code must retain the above copyright    //
//   notice.                                                           //
//                                                                     //
//         PERIDOT Project - https://github.com/osafune/peridot        //
//                                                                     //
// ******************************************************************* //

// API
//	.open(port portname, function callback(bool result));
//	.close(function callback(bool result));
//	.config(obj boardInfo, arraybuffer rbfdata[], function callback(bool result));
//	.reset(function callback(bool result, int respbyte));
//	.getinfo(function callback(bool result));
//	.avm.read(uint address, int bytenum, function callback(bool result, arraybuffer readdata[]));
//	.avm.write(uint address, arraybuffer writedata[], function callback(bool result));
//	.avm.iord(uint address, int offset, function callback(bool result, uint readdata));
//	.avm.iowr(uint address, int offset, uint writedata, function callback(bool result));
//	.avm.option(object option, function callback(bool result));

var Canarium = function() {
	var self = this;

	//////////////////////////////////////////////////
	//  公開オブジェクト 
	//////////////////////////////////////////////////

	// ライブラリのバージョン 
	// This library version
	self.version = "0.9.5";

	// 接続しているボードの情報 
	// Information of the board that this object is connected
	self.boardInfo = null;
//	{
//		id : strings,			// 'J72A' (J-7SYSTEM Works / PERIDOT board)
//		serialcode : strings	// 'xxxxxx-yyyyyy-zzzzzz'
//	};

	// デフォルトのビットレート 
	// Default bitrate
	self.serialBitrate = 115200;


	// API 
	self.open	= function(portname, callback){ devopen(portname, callback); };
	self.close	= function(callback){ devclose(callback); };
	self.config	= function(boardInfo, rbfarraybuf, callback){ devconfig(boardInfo, rbfarraybuf, callback); };
	self.reset	= function(callback){ devreset(callback); };
	self.getinfo= function(callback){ devgetinfo(callback); };

	self.avm = {
		read	: function(address, readbytenum, callback){ avmread(address, readbytenum, callback); },
		write	: function(address, writedata, callback){ avmwrite(address, writedata, callback); },
		iord	: function(address, offset, callback){ avmiord(address, offset, callback); },
		iowr	: function(address, offset, writedata, callback){ avmiowr(address, offset, writedata, callback); },
		option	: function(option, callback){ avmoption(option, callback); }
	};

	self.i2c = {
		start	: function(callback){ i2cstart(callback); },
		stop	: function(callback){ i2cstop(callback); },
		read	: function(ack, callback){ i2cread(ack, callback); },
		write	: function(writebyte, callback){ i2cwrite(writebyte, callback); }
	};



	//////////////////////////////////////////////////
	//  内部変数およびパラメータ 
	//////////////////////////////////////////////////

	// このオブジェクトが使用する通信オブジェクト 
	// The communication object which this object uses
	var comm = null;

	// このオブジェクトがボードに接続していればtrue 
	// True this object if connected to the board
	var onConnect = false;

	// このオブジェクトが接続しているボードが実行可能状態であればtrue 
	// True board of this object if it is ready to run
	var confrun = false;

	// AvalonMMトランザクションの即時応答オプション 
	// Send Immediate option of the Avalon-MM Transaction
	var avmSendImmediate = false;


	// 一度にSerial送信する最大長 
	// The maximum length of the serial send bytes
	var serialSendMaxLength = 1024;

	// シリアル受信がタイムアウトしたと判定するまでの試行回数（1Cycle = 100ms） 
	// Number of attempts to determine serial recieve has timed out
	var serialRecvTimeoutCycle = 50;

	// I2Cバスがタイムアウトしたと判定するまでの試行回数 
	// Number of attempts to determine I2C has timed out
	var i2cTimeoutCycle = 100;

	// FPGAコンフィグレーションがタイムアウトしたと判定するまでの試行回数 
	// Number of attempts to determine FPGA-Configuration has timed out
	var configTimeoutCycle = 100;

	// AvalonMMトランザクションパケットの最大データ長 
	// The maximum data byte length of the Avalon-MM Transaction packet
	var avmTransactionMaxLength = 32768;


	// デバッグメッセージを抑止 
	// Disabled debug messages 
	var debug_message_cmd = false;
	var debug_message_avm = false;
	var debug_message_avmpacket = false;
	var debug_message_i2c = false;



	//////////////////////////////////////////////////
	//  内部メソッド (シリアル入出力群)
	//////////////////////////////////////////////////

	// serialio.open(portname, options, callback(result))
	// serialio.close(callback(result))
	// serialio.write(wirtearraybuf, callback(result, bytesSend))
	// serialio.getbyte(callback(result, bytedata))
	// serialio.read(bytenum, callback(result, bytesRecv, readarraybuf))
	// serialio.flush(callback(result))

	var serialReadbufferMaxLength = 8192;
	var serialReadRetryWaitms = 100;

	var serialio = function() {
		var self = this;
		var connectionId = null;


		// シリアル受信リスナ 

		var readbuff = new ringbuffer(serialReadbufferMaxLength);

		var onReceiveCallback = function(info) {

			var data_arr = new Uint8Array(info.data);
			var leftbytes = info.data.byteLength;
			var datanum = 0;

			var _setbufferloop = function() {
				var setlength = readbuff.getfree();

				if (setlength == 0) {						// 空きが無い場合 
//					console.log("serial : readbuffer full wait...");

					setTimeout(function() { _setbufferloop(); }, serialReadRetryWaitms*10);

				} else {									// バッファに空きがある場合 
//					console.log("serial : readbuffer " + setlength + "bytes free, recieve data " + leftbytes + "bytes left.");

					if (setlength > leftbytes) setlength = leftbytes;

					for(var i=0 ; i<setlength ; i++) {
						readbuff.add(data_arr[datanum++]);
						leftbytes--;
					}

					if (leftbytes > 0) {
						setTimeout(function() { _setbufferloop(); }, serialReadRetryWaitms);
					} else {
						chrome.serial.setPaused(info.connectionId, false, function() {
//							console.log("serial : Recieve " + info.data.byteLength + "bytes done.");

						});
					}
				}
			};

			if (info.connectionId == connectionId) {
				if (readbuff.getfree() > leftbytes) {		// バッファに十分な余裕がある場合 
					for(var i=0 ; i<leftbytes ; i++) readbuff.add(data_arr[i]);
//					console.log("serial : Recieve " + info.data.byteLength + "bytes done.");

				} else {									// バッファが埋まっている場合 
					chrome.serial.setPaused(info.connectionId, true, function() {
						_setbufferloop();
					});
				}
			}
		};


		// シリアルポート接続 

		self.open = function(portname, options, callback) {
			if (connectionId != null) {
				console.log("serial : [!] Serial port is already opened.");
				callback(false);
				return;
			}

			chrome.serial.connect(portname, options, function(openInfo) {
				if (openInfo.connectionId > 0) {
					connectionId = openInfo.connectionId;
					console.log("serial : Open connectionId = " + connectionId + " (" + portname + ", " + options.bitrate + "bps)");

					chrome.serial.onReceive.addListener(onReceiveCallback);
					console.log("serial : Receive listener is start.");

					callback(true);

				} else {
					console.log("serial : [!] " + portname + " is not connectable.");

					callback(false);
				}
			});
		};


		// シリアルポート切断 

		self.close = function(callback) {
			if (connectionId == null) {
				console.log("serial : [!] Serial port is not open.");
				callback(false);
				return;
			}

		    chrome.serial.disconnect(connectionId, function() {
				console.log("serial : Close connectionId = " + connectionId);
				connectionId = null;

				callback(true);
		    });
		};


		// シリアルデータ送信 

		self.write = function(wirtearraybuf, callback) {
			if (connectionId == null) {
				console.log("serial : [!] Serial write port is not open.");
				callback(false);
				return;
			}

			var sendsize, i, offset = 0;
			var writebuffer_arr = new Uint8Array(wirtearraybuf);

			var _blobsend = function() {
				if (offset+serialSendMaxLength > wirtearraybuf.byteLength) {
					sendsize = wirtearraybuf.byteLength - offset;
				} else {
					sendsize = serialSendMaxLength;
				}
				var sendbuffer = new ArrayBuffer(sendsize);
				var sendbuffer_arr = new Uint8Array(sendbuffer);

				for(i=0 ; i<sendsize ; i++) sendbuffer_arr[i] = writebuffer_arr[offset+i];

			    chrome.serial.send(connectionId, sendbuffer, function(writeInfo) {
					if (writeInfo.bytesSent != sendsize) {
						var sb = offset + writeInfo.bytesSent;
						var lb = sb - writeInfo.bytesSent;

						console.log("serial : [!] write " + sb + "bytes written, " + lb + "bytes left.");
						callback(false, sentbytes);

					} else {
//						console.log("serial : Split send " + (offset+sendsize) + "bytes written.");
						offset += serialSendMaxLength;
						if (offset < wirtearraybuf.byteLength) {
							setTimeout(function() { _blobsend(); }, 1);		// 1msの送信遅延 
						} else {
							callback(true, wirtearraybuf.byteLength);
						}
					}
				});
			};

			_blobsend();
		};


		// シリアルデータ受信(シングルバイト) 

		self.getbyte = function(callback) {
			if (connectionId == null) {
				console.log("serial : [!] Serial read port is not open.");
				callback(false);
				return;
			}

			var retry = 0;							// ポーリングリトライ回数 

			var _byteread = function() {
				var data = readbuff.get();

				if (data == null) {					// 受信バッファが空の状態 
					if (retry < serialRecvTimeoutCycle) {
						retry++;
						setTimeout(function() { _byteread(); }, serialReadRetryWaitms);
					} else {
						console.log("serial : [!] getbyte is timeout.");
						callback(false, null);		// タイムアウト 
					}
				} else {
					callback(true, data);
				}
			};

			_byteread();
		};


		// シリアルデータ受信(マルチバイト) 

		self.read = function(bytenum, callback) {
			if (connectionId == null) {
				console.log("serial : [!] Serial read port is not open.");
				callback(false);
				return;
			}

			var readarraybuf = new ArrayBuffer(bytenum);
			var readarraybuf_arr = new Uint8Array(readarraybuf);
			var readnum = 0;

			var _blobread = function() {
				self.getbyte(function(res, data) {
					if (res) {
						readarraybuf_arr[readnum++] = data;
						if (readnum == bytenum) {
							callback(true, readnum, readarraybuf);
						} else {
							_blobread();
						}
					} else {
						callback(false, readnum, readarraybuf);
					}
				});
			};

			_blobread();
		};


		// シリアルデータ即時送信 

		self.flush = function(callback) {
			if (connectionId == null) {
				console.log("serial : [!] Serial write port is not open.");
				callback(false);
				return;
			}

			chrome.serial.flush(connectionId, function() {
				callback(true);
			});
		};
	};


	// リングバッファ 
	// bool ringbuffer.add(byte indata)
	// int ringbuffer.get()
	// int ringbuffer.getcount()

	var ringbuffer = function(bufferlength) {
		var self = this;

		self.overrun = false;		// バッファオーバーランエラー 

		var buffer = new ArrayBuffer(bufferlength);
		var buff_arr = new Uint8Array(buffer);
		var writeindex = 0;
		var readindex = 0;


		// データ書き込み 

		self.add = function(indata) {

			// バッファオーバーランのチェック 
			var nextindex = writeindex + 1;
			if (nextindex >= buff_arr.byteLength) nextindex = 0;

			if (nextindex == readindex) {
				self.overrun = true;
				console.log("serial : [!] Readbuffer overrun.");
				return false;
			}

			// バッファへ書き込み 
			buff_arr[writeindex] = indata;
			writeindex = nextindex;

			return true;
		};


		// データ読み出し 

		self.get = function() {
			if (readindex == writeindex) return null;

			var data = buff_arr[readindex];

			readindex++;
			if (readindex >= buff_arr.byteLength) readindex = 0;

			return data;
		};


		// キューされているデータ数の取得 

		self.getcount = function() {
			var len = writeindex - readindex;
			if (len < 0) len += buff_arr.byteLength;

			return len;
		};


		// キューできるデータ数の取得 

		self.getfree = function() {
			return (buff_arr.byteLength - self.getcount() - 1);
		};
	};



	//////////////////////////////////////////////////
	//  基本メソッド 
	//////////////////////////////////////////////////

	// PERIDOTデバイスポートのオープン 
	//	devopen(port portname, function callback(bool result));

	var devopen = function(portname, callback) {
		if (onConnect) {
			callback(false);		// 既に接続が確立している場合 
			return;
		}

		self.boardInfo = null;
		avmSendImmediate = false;
		confrun = false;

		comm = new serialio();		// 通信オブジェクトをインスタンス 

		// シリアルポート接続 
		var connect = function() {
			var options = {bitrate:self.serialBitrate};

			comm.open(portname, options, function(result) {
				if (result) {
					onConnect = true;
					psconfcheck();
				} else {
					open_exit(false);
				}
			});
		};

		// PERIDOTコンフィグレータ応答のテスト 
		var psconfcheck = function() {
			commandtrans(0x39, function(result, respbyte) {
				if (result) {
					console.log("board : Confirm acknowledge.");
					getboardheader();				// コマンドに応答があった 
				} else {
					console.log("board : [!] No response.");
					open_exit(false);				// コマンドに応答がなかった 
				}
			});
		};

		// EEPROMヘッダの読み取り 
		var getboardheader = function() {
			eepromread(0x00, 4, function(result, readdata) {
				if (result) {
					var readdata_arr = new Uint8Array(readdata);
					var header = (readdata_arr[0] << 16) | (readdata_arr[1] << 8) | (readdata_arr[2] << 0);

					if (header == 0x4a3757) {		// J7Wのヘッダがある 
						self.boardInfo = {version : readdata_arr[3]};
						console.log("board : EEPROM header version = " + self.boardInfo.version);
					} else {						// J7Wのヘッダがない 
						self.boardInfo = {version : 0};
						console.log("board : [!] Unknown EEPROM header.");
					}
				} else {							// EEPROMがない 
					self.boardInfo = {version : 0};
					console.log("board : [!] EEPROM not found.");
				}

				open_exit(true);
			});
		};

		// 終了処理 
		var open_exit = function(result) {
			if (result) {
				callback(true);
			} else {
				if (onConnect) {
					self.close(function() {
						callback(false);
					});
				} else {
					callback(false);
				}
			}
		};

		connect();
	};


	// PERIDOTデバイスポートのクローズ 
	//	devclose(function callback(bool result));

	var devclose = function(callback) {
		if (!onConnect) {
			callback(false);		// 接続が確立していない場合 
			return;
		}

		comm.close(function(result) {
			onConnect = false;
			confrun = false;
			self.boardInfo = null;
			comm = null;

			callback(true);
		});
	};


	// ボードのFPGAコンフィグレーション 
	//	devconfig(obj boardInfo, arraybuffer rbfdata[],
	//						function callback(bool result));

	var configBarrier = false;
	var devconfig = function(boardInfo, rbfarraybuf, callback) {

		///// コンフィグシーケンス完了まで再実行を阻止する /////

		if (!onConnect || !rbfarraybuf || configBarrier || mresetBarrier) {
			callback(false);
			return;
		}

		configBarrier = true;


		///// FPGAコンフィグレーションシーケンサ /////

		var sendretry = 0;		// タイムアウトカウンタ 

		// FPGAのコンフィグレーション開始処理 
		var setup = function() {
			commandtrans(0x3b, function(result, respbyte) {	// モードチェック、即時応答 
				if (result) {
					if ((respbyte & 0x01)== 0x00) {		// PSモード 
						console.log("config : configuration is started.");
						confrun = false;
						sendretry = 0;
						sendinit();
					} else {
						console.log("config : [!] Setting is not in the PS mode.");
						config_exit(false);
					}
				} else {
					errorabort();
				}
			});
		};

		// コンフィグレーション開始リクエスト発行 
		var sendinit = function() {
			commandtrans(0x32, function(result, respbyte) {	// コンフィグモード、nCONFIGアサート、即時応答 
				if (result) {
					if (sendretry < configTimeoutCycle) {
						if ((respbyte & 0x06)== 0x00) {		// nSTATUS = L, CONF_DONE = L
							sendretry = 0;
							sendready();
						} else {
							sendretry++;
//							console.log("config : nSTATUS assart wait " + sendretry);
							sendinit();
						}
					} else {
						console.log("config : [!] nCONFIG request is timeout.");
						config_exit(false);
					}
				} else {
					errorabort();
				}
			});
		};

		// FPGAからの応答を待つ 
		var sendready = function() {
			commandtrans(0x33, function(result, respbyte) {	// コンフィグモード、nCONFIGネゲート、即時応答 
				if (result) {
					if (sendretry < configTimeoutCycle) {
						if ((respbyte & 0x06)== 0x02) {		// nSTATUS = H, CONF_DONE = L
							sendretry = 0;
							sendrbf();
						} else {
							sendretry++;
//							console.log("config : nSTATUS negate wait " + sendretry);
							sendready();
						}
					} else {
						console.log("config : [!] nSTATUS response is timeout.");
						config_exit(false);
					}
				} else {
					errorabort();
				}
			});
		};

		// コンフィグファイル送信 
		var sendrbf = function() {
			console.log("config : RBF data send.");
			comm.write(rbfescapebuf, function(result, bytewritten) {
				if (result) {
					console.log("config : " + bytewritten + "bytes of configuration data was sent.");
					checkstatus();
				} else {
					errorabort();
				}
			});
		};

		// コンフィグ完了チェック 
		var checkstatus = function() {
			commandtrans(0x33, function(result, respbyte) {	// コンフィグモード、ステータスチェック、即時応答 
				if (result) {
					if ((respbyte & 0x06)== 0x06) {		// nSTATUS = H, CONF_DONE = H
						switchuser();
					} else {
						console.log("config : [!] configuration error.");
						config_exit(false);
					}
				} else {
					errorabort();
				}
			});
		};

		// コンフィグ完了 
		var switchuser = function() {
			commandtrans(0x39, function(result, respbyte) {	// ユーザーモード 
				if (result) {
					console.log("config : configuration completion.");
					confrun = true;
					config_exit(true);
				} else {
					errorabort();
				}
			});
		};

		// 通信エラー 
		var errorabort = function() {
			console.log("config : [!] communication error abort.");
			config_exit(false);
		};

		// 終了処理 
		var config_exit = function(result) {
			configBarrier = false;
			callback(result);
		};


		///// バイトエスケープ処理 /////

		var rbfescape = new Array();
		var rbfarraybuf_arr = new Uint8Array(rbfarraybuf);
		var escape_num = 0;

		for(var i=0 ; i<rbfarraybuf.byteLength ; i++) {
			if (rbfarraybuf_arr[i] == 0x3a || rbfarraybuf_arr[i] == 0x3d) {
				rbfescape.push(0x3d);
				rbfescape.push(rbfarraybuf_arr[i] ^ 0x20);
				escape_num++;
			} else {
				rbfescape.push(rbfarraybuf_arr[i]);
			}
		}

		var rbfescapebuf = new ArrayBuffer(rbfescape.length);
		var rbfescapebuf_arr = new Uint8Array(rbfescapebuf);
		var checksum = 0;

		for(var i=0 ; i<rbfescape.length ; i++) {
			rbfescapebuf_arr[i] = rbfescape[i];
			checksum = (checksum + rbfescapebuf_arr[i]) & 0xff;
		}

		console.log("config : " + escape_num + " places were escaped. config data size = " + rbfescapebuf.byteLength + "bytes");


		///// コンフィグレーションの実行 /////

		if (boardInfo) {
			devgetinfo( function(result) {		// boardInfoでターゲットを制限する場合 
				if (result) {
					var conf = true;
					if ('id' in boardInfo && boardInfo.id != self.boardInfo.id) {
						conf = false;
						console.log("config : [!] Board ID is not in agreement.");
					}
					if ('serialcode' in boardInfo && boardInfo.serialcode != self.boardInfo.serialcode) {
						conf = false;
						console.log("config : [!] Board serial-code is not in agreement.");
					}

					if (conf) {
						setup();
					} else {
						config_exit(false);
					}
				} else {
					config_exit(false);
				}
			});
		} else {
			setup();
		}
	};


	// ボードのマニュアルリセット 
	//	devreset(function callback(bool result, int respbyte));

	var mresetBarrier = false;
	var devreset = function(callback) {
		if (!onConnect || mresetBarrier) {
			callback(false);
			return;
		}

		mresetBarrier = true;

		var resetassert = function() {
			commandtrans(0x31, function(result, respbyte) {
				if (result) {
					setTimeout(function(){ resetnegate(); }, 100);	// 100ms後にリセットを解除する 
				} else {
					reset_exit(false, null);
				}
			});
		};

		var resetnegate = function() {
			commandtrans(0x39, function(result, respbyte) {
				if (result) {
					console.log("mreset : The issue complete.");
					avmSendImmediate = false;
					reset_exit(true, respbyte);
				} else {
					reset_exit(false, null);
				}
			});
		};

		var reset_exit = function(result, respbyte) {
			mresetBarrier = false;
			callback(result, respbyte);
		};

		resetassert();
	};


	// ボード情報の取得 
	//	devgetinfo(function callback(bool result));

	var getinfoBarrier = false;
	var devgetinfo = function(callback) {
		if (!onConnect || getinfoBarrier) {
			callback(false);
			return;
		}

		getinfoBarrier = true;

		// ver.1ヘッダ 
		var getboadinfo_v1 = function() {
			eepromread(0x04, 8, function(result, readdata) {
				if (result) {
					var readdata_arr = new Uint8Array(readdata);
					var mid = (((readdata_arr[0] << 8) | (readdata_arr[1] << 0))>>> 0);
					var pid = (((readdata_arr[2] << 8) | (readdata_arr[3] << 0))>>> 0);
					var sid = (((readdata_arr[4] << 24) | (readdata_arr[5] << 16) | (readdata_arr[6] << 8)|(readdata_arr[7] << 0))>>> 0);

					if (mid == 0x0072) {
						var s = ("0000" + pid.toString(16)).slice(-4) + ("00000000" + sid.toString(16)).slice(-8);
						self.boardInfo.id = "J72A";
						self.boardInfo.serialcode = s.substr(0,6) + "-" + s.substr(6,6) + "-000000";
					}
				}

				getinfo_exit(result);
			});
		};

		// ver.2ヘッダ 
		var getboadinfo_v2 = function() {
			eepromread(0x04, 22, function(result, readdata) {
				if (result) {
					var readdata_arr = new Uint8Array(readdata);
					var bid = "";
					var sid = "";

					for(var i=0 ; i<4 ; i++) bid += String.fromCharCode(readdata_arr[i]);

					for(var i=0 ; i<18 ; i++) {
						sid += String.fromCharCode(readdata_arr[4+i]);
						if (i == 5 || i == 11) sid += "-";
					}

					self.boardInfo.id = bid;
					self.boardInfo.serialcode = sid;
				}

				getinfo_exit(result);
			});
		};

		//  EEPROMが無い、または内容が不正 
		var getboadinfo_def = function() {
			self.boardInfo.id = "";
			self.boardInfo.serialcode = "";

			getinfo_exit(true);
		};

		// 終了処理 
		var getinfo_exit = function(result) {
			if (result) {
				console.log("board : version = " + self.boardInfo.version + "\n" +
							"        id = " + self.boardInfo.id + "\n" +
							"        serialcode = " + self.boardInfo.serialcode
				);
			}

			getinfoBarrier = false;
			callback(result);
		};


		switch(self.boardInfo.version) {
		case 1 :					// ヘッダver.1
			getboadinfo_v1();
			break;

		case 2 : 					// ヘッダver.2
			getboadinfo_v2();
			break;

		default :				// EEPROMが無い、または内容が不正 
			getboadinfo_def();
			break;
		}
	};



	//////////////////////////////////////////////////
	//  Avalon-MMトランザクションメソッド 
	//////////////////////////////////////////////////

	// AvalonMMオプション設定 
	//	avmoption(object option,
	//					function callback(bool result);

	var avmoption = function(option, callback) {
//		if (!onConnect || !confrun || mresetBarrier) {
		if (!onConnect || mresetBarrier) {
			callback(false);
			return;
		}

		var avmoption_exit = function(result) {
			callback(result);
		};

		if (option.fastAcknowledge != null) {
			if (option.fastAcknowledge) {
				avmSendImmediate = true;
			} else {
				avmSendImmediate = false;
			}

			var com = 0x39;
			if (avmSendImmediate) com |= 0x02;	// 即時応答モードビットのセット 

			commandtrans(com, function(result, respbyte) {
				if (result) console.log("avm : Set option send immediate is " + avmSendImmediate);

				avmoption_exit(result);
			});

		} else {
			avmoption_exit(true);
		}
	};


	// AvalonMMペリフェラルリード(IORD)
	//	avmiord(uint address, int offset,
	//					function callback(bool result, uint readdata));

	var avmiord = function(address, offset, callback) {
		if (!onConnect || !confrun || mresetBarrier) {
			callback(false, null);
			return;
		}

		var regaddr = ((address & 0xfffffffc)>>> 0) + (offset << 2);
		var writepacket = new avmPacket(0x10, 4, regaddr, 0);	// シングルリードパケットを生成 
		var readdata = null;

		avmtrans(writepacket, function(result, readpacket) {
			var res = false;

			if (result && readpacket.byteLength == 4) {
				var readpacket_arr = new Uint8Array(readpacket);
				readdata = (
						(readpacket_arr[3] << 24) |
						(readpacket_arr[2] << 16) |
						(readpacket_arr[1] <<  8) |
						(readpacket_arr[0] <<  0) )>>> 0;		// 符号なし32bit整数 
				res = true;

				if (debug_message_avm) {
					console.log("avm : iord(0x" + ("00000000"+address.toString(16)).slice(-8) + ", " + offset + ") = 0x" + ("00000000"+readdata.toString(16)).slice(-8));
				}
			}
			if (!res) console.log("avm : [!] iord failed.");

			callback(res, readdata);
		});
	};


	// AvalonMMペリフェラルライト(IOWR)
	//	avmiowr(uint address, int offset, uint writedata,
	//					function callback(bool result));

	var avmiowr = function(address, offset, writedata, callback) {
		if (!onConnect || !confrun || mresetBarrier) {
			callback(false);
			return;
		}

		var regaddr = ((address & 0xfffffffc)>>> 0) + (offset << 2);
		var writepacket = new avmPacket(0x00, 4, regaddr, 4);	// シングルライトパケットを生成 
		var writepacket_arr = new Uint8Array(writepacket);

		writepacket_arr[8]  = (writedata >>>  0) & 0xff;		// 符号なし32bit整数 
		writepacket_arr[9]  = (writedata >>>  8) & 0xff;
		writepacket_arr[10] = (writedata >>> 16) & 0xff;
		writepacket_arr[11] = (writedata >>> 24) & 0xff;

		avmtrans(writepacket, function(result, readpacket) {
			var res = false;

			if (result) {
				var readpacket_arr = new Uint8Array(readpacket);
				var size = (readpacket_arr[2] << 8) | (readpacket_arr[3] << 0);

				if (readpacket_arr[0] == 0x80 && size == 4) {
					res = true;

					if (debug_message_avm) {
						console.log("avm : iowr(0x" + ("00000000"+address.toString(16)).slice(-8) + ", " + offset + ", 0x" + ("00000000"+writedata.toString(16)).slice(-8) + ")");
					}
				}
			}
			if (!res) console.log("avm : [!] iowr failed.");

			callback(res);
		});
	};


	// AvalonMMメモリリード(IORD_DIRECT)
	//	avmread(uint address, int bytenum,
	//					function callback(bool result, arraybuffer readdata[]));

	var avmread = function(address, readbytenum, callback) {
		if (!onConnect || !confrun || mresetBarrier) {
			callback(false, null);
			return;
		}

		var readdata = new ArrayBuffer(readbytenum);
		var readdata_arr = new Uint8Array(readdata);
		var byteoffset = 0;
		var leftbytenum = readbytenum;

		var _partialread_loop = function() {
			var bytenum = leftbytenum;
			if (bytenum > avmTransactionMaxLength) bytenum = avmTransactionMaxLength;

			var nextaddress = address + byteoffset;
			var writepacket = new avmPacket(0x14, bytenum, nextaddress, 0);		// インクリメンタルリードパケットを生成 

			avmtrans(writepacket, function(result, readpacket) {
				if (result) {
					if (bytenum == readpacket.byteLength) {
						var readpacket_arr = new Uint8Array(readpacket);

						for(var i=0 ; i<bytenum ; i++) readdata_arr[byteoffset++] = readpacket_arr[i];
						leftbytenum -= bytenum;

						if (debug_message_avm) {
							console.log("avm : read " + bytenum + "bytes from address 0x" + ("00000000"+nextaddress.toString(16)).slice(-8));
						}

						if (leftbytenum > 0) {
							_partialread_loop();
						} else {
							_partialread_exit(true);
						}
					} else {
						_partialread_exit(false);
					}
				} else {
					_partialread_exit(false);
				}
			});
		};
		var _partialread_exit = function(res) {
			if (res) {
				callback(true, readdata);
			} else {
				console.log("avm : [!] memrd failed.");
				callback(false, null);
			}
		};

		_partialread_loop();
	};


	// AvalonMMメモリライト(IOWR_DIRECT)
	//	avmwrite(uint address, arraybuffer writedata[],
	//					function callback(bool result));

	var avmwrite = function(address, writedata, callback) {
		if (!onConnect || !confrun || mresetBarrier) {
			callback(false, null);
			return;
		}

		var writedata_arr = new Uint8Array(writedata);
		var byteoffset = 0;
		var leftbytenum = writedata.byteLength;

		var _partialwrite_loop = function() {
			var bytenum = leftbytenum;
			if (bytenum > avmTransactionMaxLength) bytenum = avmTransactionMaxLength;

			var nextaddress = address + byteoffset;
			var writepacket = new avmPacket(0x04, bytenum, nextaddress, bytenum);	// インクリメンタルライトパケットを生成 
			var writepacket_arr = new Uint8Array(writepacket);

			for(var i=0 ; i<bytenum ; i++) writepacket_arr[8+i] = writedata_arr[byteoffset++];

			avmtrans(writepacket, function(result, readpacket) {
				if (result) {
					var readpacket_arr = new Uint8Array(readpacket);
					var size = (readpacket_arr[2] << 8) | (readpacket_arr[3] << 0);

					if (readpacket_arr[0] == 0x84 && size == bytenum) {
						leftbytenum -= bytenum;

						if (debug_message_avm) {
							console.log("avm : written " + bytenum + "bytes to address 0x" + ("00000000"+nextaddress.toString(16)).slice(-8));
						}

						if (leftbytenum > 0) {
							_partialwrite_loop();
						} else {
							_partialwrite_exit(true);
						}
					} else {
						_partialwrite_exit(false);
					}
				} else {
					_partialwrite_exit(false);
				}
			});
		};
		var _partialwrite_exit = function(res) {
			if (res) {
				callback(true);
			} else {
				console.log("avm : [!] memwr failed.");
				callback(false);
			}
		};


		_partialwrite_loop();
	};



	//////////////////////////////////////////////////
	//  内部メソッド (トランザクションコマンド群)
	//////////////////////////////////////////////////

	// コンフィグレーションコマンドの送受信 
	//	commandtrans(int command, function callback(bool result, int response);
	var commandBarrier = false;
	var commandtrans = function(command, callback) {

		///// コマンド送受信完了まで再実行を阻止する /////

		if (commandBarrier) {
			callback(false, null);
			return;
		}

		commandBarrier = true;


		///// 終了処理部 /////

		var commandtrans_exit = function(result, respbyte) {
			commandBarrier = false;
			callback(result, respbyte);
		};


		///// コマンドの生成と送受信 /////

		var send_data = new ArrayBuffer(2);
		var send_data_arr = new Uint8Array(send_data);

		send_data_arr[0] = 0x3a;
		send_data_arr[1] = command & 0xff;

		if (debug_message_cmd) {
			console.log("cmd : send config command = 0x" + ("0"+send_data_arr[1].toString(16)).slice(-2));
		}

		// (ここから逐次処理記述) 
		comm.write(send_data, function(result, bytes) { if (result) {
		comm.flush(function(result) { if (result) {

		comm.getbyte(function(result, respbyte) { if (result) {
			if (debug_message_cmd) {
				console.log("cmd : recieve config response = 0x" + ("0"+respbyte.toString(16)).slice(-2));
			}

		commandtrans_exit(true, respbyte);
		} else { commandtrans_exit(false, null); } });
		} else { commandtrans_exit(false, null); } });
		} else { commandtrans_exit(false, null); } });
	};


	// AvalonMMトランザクションパケットを作成 
	// arraybuffer avmPacket(int command, uint size, uint address, int datasize);
	var avmPacket = function(command, size, address, datasize) {
		var packet = new ArrayBuffer(8 + datasize);
		var packet_arr = new Uint8Array(packet);

		packet_arr[0] = command & 0xff;
		packet_arr[1] = 0x00;
		packet_arr[2] = (size >>> 8) & 0xff;
		packet_arr[3] = (size >>> 0) & 0xff;
		packet_arr[4] = (address >>> 24) & 0xff;
		packet_arr[5] = (address >>> 16) & 0xff;
		packet_arr[6] = (address >>>  8) & 0xff;
		packet_arr[7] = (address >>>  0) & 0xff;

		return packet;
	};


	// トランザクションパケットの送受信 
	//	avmtrans(arraybuffer writepacket[],
	//						function callback(bool result, arraybuffer readpacket[]));
	var avmBarrier = false;
	var avmtrans = function(writepacket, callback) {

		///// パケット送受信完了まで再実行を阻止する /////

		if (avmBarrier) {
			callback(false, null);
			return;
		}

		avmBarrier = true;


		///// 終了処理部 /////

		var _recv_exit = function(result, readpacket) {
			if (result) {
//				console.log("avm : recieve transaction true, packet size " + readpacket.byteLength + "bytes.");
			} else {
				console.log("avm : [!] transaction failed.");
			}

			avmBarrier = false;
			callback(result, readpacket);
		};


		///// パケット受信処理部 /////

		var resparray = new Array();
		var recvlogarray = new Array();		// ログ用 
		var recvSOP = false;
		var recvEOP = false;
		var recvCNI = false;
		var recvESC = false;

		var _recv_loop = function() {
			comm.getbyte(function(result, recvbyte) {
				if (result) {
					var recvexit = false;

					recvlogarray.push(recvbyte);	// 受信データを全てログ(テスト用) 

					// パケットフレームの外側の処理 
					if (!recvSOP) {
						if (recvCNI) {				// CNIの２バイト目の場合は読み捨てる 
							recvCNI = false;
						} else {
							switch(recvbyte) {
							case 0x7a:				// SOPを受信 
								recvSOP = true;
								break;

							case 0x7c:				// CNIを受信 
								recvCNI = true;
								break;

							default:				// それ以外は無視する  
								break;
							}
						}

					// パケットフレームの内側の処理 
					} else {
						if (recvCNI) {				// CNIの２バイト目の場合は読み捨てる 
							recvCNI = false;

						} else if (recvESC) {		// ESCの２バイト目の場合はバイト復元して追加 
							recvESC = false;
							resparray.push(recvbyte ^ 0x20);

							if (recvEOP) {			// ESCがEOPの２バイト目だった場合はここで終了 
								recvEOP = false;
								recvSOP = false;
								recvexit = true;
							}

						} else if (recvEOP) {		// EOPの２バイト目の場合の処理 
							if (recvbyte == 0x7d) {		// 後続がバイトエスケープされている場合は続行 
								recvESC = true;
							} else {					// エスケープでなければバイト追加して終了 
								resparray.push(recvbyte);
								recvEOP = false;
								recvSOP = false;
								recvexit = true;
							}

						} else {					// 先行バイトがパケット指示子ではない場合 
							switch(recvbyte) {
							case 0x7a:				// SOP受信 
								break;				// パケット中にはSOPは出現しないのでエラーにすべき？ 

							case 0x7b:				// EOP受信 
								recvEOP = true;
								break;

							case 0x7c:				// CNI受信 
								recvCNI = true;
								break;

							case 0x7d:				// ESC受信 
								recvESC = true;
								break;

							default:				// それ以外はバイト追加  
								resparray.push(recvbyte);
							}
						}
					}

					// レスポンスパケットの成形 
					if (recvexit) {	
						var readpacket = new ArrayBuffer(resparray.length);
						var readpacket_arr = new Uint8Array(readpacket);

						for(var i=0 ; i<resparray.length ; i++) readpacket_arr[i] = resparray[i];

						if (debug_message_avm && debug_message_avmpacket) {
							var recvstr = "";
							for(var i=0 ; i<recvlogarray.length ; i++) recvstr = recvstr + ("0"+recvlogarray[i].toString(16)).slice(-2) + " ";
							console.log("avm : received data = " + recvstr);
						}

						_recv_exit(true, readpacket);
					} else {
						_recv_loop();
					}

				} else {
					_recv_exit(false, null);		// バイトデータの受信に失敗 
				}
			});
		};


		///// 送信パケット前処理 /////

		var writepacket_arr = new Uint8Array(writepacket);
		var sendarray = new Array();

		sendarray.push(0x7a);		// SOP
		sendarray.push(0x7c);		// CNI
		sendarray.push(0x00);		// Ch.0 (ダミー)

		for(var i=0 ; i<writepacket.byteLength ; i++) {
			// EOPの挿入 
			if (i == writepacket.byteLength-1) sendarray.push(0x7b);	// EOP 

			// Byte to Packet Converter部のバイトエスケープ 
			if (writepacket_arr[i] == 0x7a || writepacket_arr[i] == 0x7b || writepacket_arr[i] == 0x7c || writepacket_arr[i] == 0x7d) {
				sendarray.push(0x7d);
				sendarray.push(writepacket_arr[i] ^ 0x20);

			// PERIDOT Configrator部のバイトエスケープ 
			} else if (writepacket_arr[i] == 0x3a || writepacket_arr[i] == 0x3d) {
				sendarray.push(0x3d);
				sendarray.push(writepacket_arr[i] ^ 0x20);

			// それ以外 
			} else {
				sendarray.push(writepacket_arr[i]);
			}
		}

		var send_data = new ArrayBuffer(sendarray.length);
		var send_data_arr = new Uint8Array(send_data);

		for(var i=0 ; i<sendarray.length ; i++) send_data_arr[i] = sendarray[i];

		if (debug_message_avm && debug_message_avmpacket) {
			var sendstr = "";
			for(var i=0 ; i<send_data.byteLength ; i++) sendstr = sendstr + ("0"+send_data_arr[i].toString(16)).slice(-2) + " ";
			console.log("avm : sending data = " + sendstr);
		}


		///// パケットの送受信 /////

		comm.write(send_data, function(result, bytes) {
			if (result) {
//				console.log("avm : send transaction true, packet size " + bytes + "bytes.");

				if (avmSendImmediate) {
					comm.flush( function(result) {
						if (result) {
							_recv_loop();
						} else {
							_recv_exit(false, null);
						}
					});
				} else {
					_recv_loop();
				}
			} else {
				_recv_exit(false, null);
			}
		});
	};



	//////////////////////////////////////////////////
	//  内部メソッド (I2Cコマンド群)
	//////////////////////////////////////////////////

	var i2cBarrier = false;

	// 1bitデータを読むサブファンクション (必ずSCL='L'が先行しているものとする) 
	// i2cbitread(function callback(bool result, int readbit));
	var i2cbitread = function(callback) {
		var readbit = 0;
		var timeout = 0;
		var setup = function() {
			commandtrans(0x3b, function(result, respbyte) {		// SDA='Z',SCL='H',即時応答 
				if (result) {
					if ((respbyte & 0x10)== 0x10) {				// SCLが立ち上がったらSDAを読む 
						if ((respbyte & 0x20)== 0x20) readbit = 1;
						change();
					} else {
						if (timeout < i2cTimeoutCycle) {
							timeout++;
							setup();
						} else {
							console.log("i2c : [!] Read condition is timeout.");
							callback(false, null);
						}
					}
				} else {
					callback(false, null);
				}
			});
		};

		var change = function() {
			commandtrans(0x2b, function(result, respbyte) {		// SDA='Z',SCL='L',即時応答 
				if (result) {
					callback(true, readbit);
				} else {
					callback(false, null);
				}
			});
		};

		setup();
	};

	// 1bitデータを書くサブファンクション (必ずSCL='L'が先行しているものとする) 
	// i2cbitwrite(int writebit, function callback(bool result));
	var i2cbitwrite = function(writebit, callback) {
		var setup = function() {
			var com = (writebit << 5) | 0x0b;
			commandtrans(com, function(result, respbyte) {		// SDA=writebit,SCL='L',即時応答 
				if (result) {
					hold();
				} else {
					callback(false);
				}
			});
		};

		var timeout = 0;
		var hold = function() {
			var com = (writebit << 5) | 0x1b;
			commandtrans(com, function(result, respbyte) {		// SDA=writebit,SCL='H',即時応答 
				if (result) {
					if ((respbyte & 0x30) == (com & 0x30)) {	// SCLが立ち上がったら次へ 
						change();
					} else {
						if (timeout < i2cTimeoutCycle) {
							timeout++;
							hold();
						} else {
							console.log("i2c : [!] Write condition is timeout.");
							callback(false);
						}
					}
				} else {
					callback(false);
				}
			});
		};

		var change = function() {
			var com = (writebit << 5) | 0x0b;
			commandtrans(com, function(result, respbyte) {		// SDA=writebit,SCL='L',即時応答 
				if (result) {
					callback(true);
				} else {
					callback(false);
				}
			});
		};

		setup();
	};

	// スタートコンディションの送信 
	// i2cstart(function callback(bool result));
	var i2cstart = function(callback) {
		if (i2cBarrier) {
			callback(false);
			return;
		}

		i2cBarrier = true;

		var timeout = 0;
		var setup = function() {
			commandtrans(0x3b, function(result, respbyte) {		// SDA='H',SCL='H',即時応答 
				if (result) {
					if ((respbyte & 0x30)== 0x30) {
						sendstart();
					} else {
						if (timeout < i2cTimeoutCycle) {
							timeout++;
							setup();
						} else {
							console.log("i2c : [!] Start condition is timeout.");
							i2cstart_exit(false);
						}
					}
				} else {
					i2cstart_exit(false);
				}
			});
		};

		var sendstart = function() {
			commandtrans(0x1b, function(result, respbyte) {		// SDA='L',SCL='H',即時応答 
				if (result) {
					sclassert();
				} else {
					i2cstart_exit(false);
				}
			});
		};

		var sclassert = function() {
			commandtrans(0x0b, function(result, respbyte) {		// SDA='L',SCL='L',即時応答 
				if (result) {
					if (debug_message_i2c) console.log("i2c : Start condition.");

					i2cstart_exit(true);
				} else {
					i2cstart_exit(false);
				}
			});
		};

		var i2cstart_exit = function(result) {
			i2cBarrier = false;
			callback(result);
		};

		setup();
	};

	// ストップコンディションの送信 (必ずSCL='L'が先行しているものとする) 
	// i2cstop(function callback(bool result));
	var i2cstop = function(callback) {
		if (i2cBarrier) {
			callback(false);
			return;
		}

		i2cBarrier = true;

		var timeout = 0;
		var setup = function() {
			commandtrans(0x0b, function(result, respbyte) {		// SDA='L',SCL='L',即時応答 
				if (result) {
					sclrelease();
				} else {
					i2cstop_exit(false);
				}
			});
		};

		var sclrelease = function() {
			commandtrans(0x1b, function(result, respbyte) {		// SDA='L',SCL='H',即時応答 
				if (result) {
					if ((respbyte & 0x30)== 0x10) {
						timeout = 0;
						sendstop();
					} else {
						if (timeout < i2cTimeoutCycle) {
							timeout++;
							setup();
						} else {
							console.log("i2c : [!] Stop condition is timeout.");
							i2cstop_exit(false);
						}
					}
				} else {
					i2cstop_exit(false);
				}
			});
		};

		var sendstop = function() {
			commandtrans(0x3b, function(result, respbyte) {		// SDA='H',SCL='H',即時応答 
				if (result) {
					if ((respbyte & 0x30)== 0x30) {
						if (debug_message_i2c) console.log("i2c : Stop condition.");

						i2cstop_exit(true);
					} else {
						if (timeout < i2cTimeoutCycle) {
							timeout++;
							sendstop();
						} else {
							console.log("i2c : [!] Stop condition is timeout.");
							i2cstop_exit(false);
						}
					}
				} else {
					i2cstop_exit(false);
				}
			});
		};

		var i2cstop_exit = function(result) {
			var com = 0x39;
			if (avmSendImmediate) com |= 0x02;

			commandtrans(com, function(res, respbyte) {		// 即時応答ビットを復元 
				i2cBarrier = false;
				callback(result && res);
			});
		};

		setup();
	};

	// バイトリード (必ずSCL='L'が先行しているものとする) 
	// i2cread(bool ack, function callback(bool result, int readbyte));
	var i2cread = function(ack, callback) {
		if (i2cBarrier) {
			callback(false, null);
			return;
		}

		i2cBarrier = true;

		var bitnum = 0;
		var readbyte = 0x00;

		var byteread = function() {
			i2cbitread(function(result, readbit) {
				if (result) {
					readbyte |= readbit;
	
					if (bitnum < 7) {
						bitnum++;
						readbyte <<= 1;
						byteread();
					} else {
						sendack();
					}
				} else {
					i2cread_exit(false, null);
				}
			});
		};

		var sendack = function() {
			var ackbit = 0;
			if (!ack) ackbit = 1;	// NACK

			i2cbitwrite(ackbit, function(result) {
				if (result) {

					if (debug_message_i2c) {
						var str = " ACK";
						if (!ack) str = " NACK";
						console.log("i2c : read 0x" + ("0"+readbyte.toString(16)).slice(-2) + str);
					}

					i2cread_exit(true, readbyte);
				} else {
					i2cread_exit(false, null);
				}
			});

		};

		var i2cread_exit = function(result, respbyte) {
			i2cBarrier = false;
			callback(result, respbyte);
		};

		byteread();
	};

	// バイトライト (必ずSCL='L'が先行しているものとする) 
	// i2cwrite(int writebyte, function callback(bool result, bool ack));
	var i2cwrite = function(writebyte, callback) {
		if (i2cBarrier) {
			callback(false);
			return;
		}

		i2cBarrier = true;

		var bitnum = 0;
		var senddata = writebyte;
		var bytewrite = function() {
			var writebit = 0;
			if ((senddata & 0x80)!= 0x00) writebit = 1;

			i2cbitwrite(writebit, function(result) {
				if (result) {
					if (bitnum < 7) {
						bitnum++;
						senddata <<= 1;
						bytewrite();
					} else {
						recvack();
					}
				} else {
					i2cwrite_exit(false, null);
				}
			});
		};

		var recvack = function() {
			i2cbitread(function(result, readbit) {
				if (result) {
					var ack = true;
					if (readbit != 0) ack = false;

					if (debug_message_i2c) {
						var str = " ACK";
						if (!ack) str = " NACK";
						console.log("i2c : write 0x" + ("0"+writebyte.toString(16)).slice(-2) + str);
					}

					i2cwrite_exit(true, ack);
				} else {
					i2cwrite_exit(false, null);
				}
			});
		};

		var i2cwrite_exit = function(result, ack) {
			i2cBarrier = false;
			callback(result, ack);
		};

		bytewrite();
	};


	// ボードのEEPROMを読み出す 
	// eepromread(int startaddr, int readbytes, function callback(bool result, arraybuffer readdata[]));
	var eepromBarrier = false;
	var eepromread = function(startaddr, readbytes, callback) {
		if (eepromBarrier) {
			callback(false, null);
			return;
		}

		eepromBarrier = true;

		var deviceaddr = 0xa0;
		var readdata = new ArrayBuffer(readbytes);
		var readdata_arr = new Uint8Array(readdata);

		var byteread = function(byteaddr, callback) {
			var data = null;

			var start = function() {
				i2cstart(function(result) {
					if (result) {
						devwriteopen();
					} else {
						exit();
					}
				});
			};

			var devwriteopen = function() {
				i2cwrite((deviceaddr | 0), function(result, ack) {
					if (result && ack) {
						if (debug_message_i2c) {
							console.log("i2c : Open device 0x" + ("0"+deviceaddr.toString(16)).slice(-2));
						}

						setaddr();
					} else {
						console.log("i2c : [!] Device 0x" + ("0"+deviceaddr.toString(16)).slice(-2) + " is not found.");

						devclose();
					}
				});
			};

			var setaddr = function() {
				i2cwrite(byteaddr, function(result, ack) {
					if (result && ack) {
						repstart();
					} else {
						devclose();
					}
				});
			};

			var repstart = function() {
				i2cstart(function(result) {
					if (result) {
						devreadopen();
					} else {
						devclose();
					}
				});
			};

			var devreadopen = function() {
				i2cwrite((deviceaddr | 1), function(result, ack) {
					if (result && ack) {
						readdata();
					} else {
						devclose();
					}
				});
			};

			var readdata = function() {
				i2cread(false, function(result, readbyte) {
					if (result) {
						data = readbyte;
					}
					devclose();
				});
			};

			var devclose = function() {
				i2cstop(function(res) {
					exit();
				});
			};

			var exit = function() {
				if (data != null) {
					callback(true, data);
				} else {
					callback(false, data);
				}
			};

			start();
		};

		var bytenum = 0;
		var idread = function() {
			byteread(startaddr, function(result, data) {
				if (result) {
					readdata_arr[bytenum++] = data;

					if (bytenum < readdata.byteLength) {
						startaddr++;
						idread();
					} else {
						eepromread_exit(true, readdata);
					}
				} else {
					eepromread_exit(false, null);
				}
			});
		};

		var eepromread_exit = function(result, databuf) {
			eepromBarrier = false;
			callback(result, databuf);
		};

		idread();
	}
}

