
module motor_controller_core (
	clk_clk,
	reset_reset_n,
	sci_sclk,
	sci_txd,
	sci_txr_n,
	sci_rxd,
	sci_rxr_n,
	motor_ch1_export,
	motor_ch2_export,
	motor_ch3_export,
	motor_ch4_export,
	motor_ch5_export,
	pwmled_export,
	sysled_export);	

	input		clk_clk;
	input		reset_reset_n;
	input		sci_sclk;
	input		sci_txd;
	output		sci_txr_n;
	output		sci_rxd;
	input		sci_rxr_n;
	output	[9:0]	motor_ch1_export;
	output	[9:0]	motor_ch2_export;
	output	[9:0]	motor_ch3_export;
	output	[9:0]	motor_ch4_export;
	output	[9:0]	motor_ch5_export;
	output	[7:0]	pwmled_export;
	output		sysled_export;
endmodule
