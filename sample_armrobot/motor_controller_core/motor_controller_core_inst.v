	motor_controller_core u0 (
		.clk_clk          (<connected-to-clk_clk>),          //       clk.clk
		.reset_reset_n    (<connected-to-reset_reset_n>),    //     reset.reset_n
		.sci_sclk         (<connected-to-sci_sclk>),         //       sci.sclk
		.sci_txd          (<connected-to-sci_txd>),          //          .txd
		.sci_txr_n        (<connected-to-sci_txr_n>),        //          .txr_n
		.sci_rxd          (<connected-to-sci_rxd>),          //          .rxd
		.sci_rxr_n        (<connected-to-sci_rxr_n>),        //          .rxr_n
		.motor_ch1_export (<connected-to-motor_ch1_export>), // motor_ch1.export
		.motor_ch2_export (<connected-to-motor_ch2_export>), // motor_ch2.export
		.motor_ch3_export (<connected-to-motor_ch3_export>), // motor_ch3.export
		.motor_ch4_export (<connected-to-motor_ch4_export>), // motor_ch4.export
		.motor_ch5_export (<connected-to-motor_ch5_export>), // motor_ch5.export
		.pwmled_export    (<connected-to-pwmled_export>),    //    pwmled.export
		.sysled_export    (<connected-to-sysled_export>)     //    sysled.export
	);

