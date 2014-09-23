ARM-ROBOT Controller
====================

FPGAマガジン７号記事のChromeアプリケーションです。  


動作環境
==========

chromeapps以下のcrxをドラッグ＆ドロップでインストールします。  

- Google Chrome 37以降
- PERIDOTボード（v1.0/v1.1）
- Windows7/8.1およびChromebookで動作確認

PERIDOTボードについては下記リポジトリを参照してください。  
[github.com/osafune/peridot](https://github.com/osafune/peridot)  


モータードライバシールド
========================

モータードライバはBD6211Fを５チャネル分使います。  
各チャネルのVSETは1bitΔΣDACによる出力を行います。アナログ電圧に変換するために、外部に1kΩと0.1uFのCR一次LPFが必要です。  


PERIDOTボードのピンアサイン
---------------------------

|I/Oピン|信号名|説明|
|---|---|---|
|D0|CH1_IN1|CH1の正転・逆転制御1|
|D1|CH1_IN2|CH1の正転・逆転制御2|
|D2|CH2_IN1|CH2の正転・逆転制御1|
|D3|CH2_IN2|CH2の正転・逆転制御2|
|D4|CH3_IN1|CH3の正転・逆転制御1|
|D5|CH3_IN2|CH3の正転・逆転制御2|
|D6|CH4_IN1|CH4の正転・逆転制御1|
|D7|CH4_IN2|CH4の正転・逆転制御2|
|D8|CH5_IN1|CH5の正転・逆転制御1|
|D9|CH5_IN2|CH5の正転・逆転制御2|
|D10|CH1_VSET|CH1の駆動電圧設定出力(1bitΔΣ出力)|
|D11|CH2_VSET|CH2の駆動電圧設定出力(1bitΔΣ出力)|
|D12|CH3_VSET|CH3の駆動電圧設定出力(1bitΔΣ出力)|
|D13|CH4_VSET|CH4の駆動電圧設定出力(1bitΔΣ出力)|
|D14|CH5_VSET|CH5の駆動電圧設定出力(1bitΔΣ出力)|
|D21|LED_PWM|LEDのPWM出力（負論理）|


使い方
======

PERIDOTボードを接続してアプリケーションを起動します。  
シリアルポートを指定して接続すると、自動的にFPGAのコンフィグレーションが行われます。ボードにコンフィグレーションデータを書き込む必要ありません。  
FPGAのプロジェクトは同梱のsample_armrobot以下です。  


ライセンス
=========

[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0)
