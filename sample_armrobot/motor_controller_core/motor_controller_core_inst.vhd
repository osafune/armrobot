	component motor_controller_core is
		port (
			clk_clk          : in  std_logic                    := 'X'; -- clk
			reset_reset_n    : in  std_logic                    := 'X'; -- reset_n
			sci_sclk         : in  std_logic                    := 'X'; -- sclk
			sci_txd          : in  std_logic                    := 'X'; -- txd
			sci_txr_n        : out std_logic;                           -- txr_n
			sci_rxd          : out std_logic;                           -- rxd
			sci_rxr_n        : in  std_logic                    := 'X'; -- rxr_n
			motor_ch1_export : out std_logic_vector(9 downto 0);        -- export
			motor_ch2_export : out std_logic_vector(9 downto 0);        -- export
			motor_ch3_export : out std_logic_vector(9 downto 0);        -- export
			motor_ch4_export : out std_logic_vector(9 downto 0);        -- export
			motor_ch5_export : out std_logic_vector(9 downto 0);        -- export
			pwmled_export    : out std_logic_vector(7 downto 0);        -- export
			sysled_export    : out std_logic                            -- export
		);
	end component motor_controller_core;

	u0 : component motor_controller_core
		port map (
			clk_clk          => CONNECTED_TO_clk_clk,          --       clk.clk
			reset_reset_n    => CONNECTED_TO_reset_reset_n,    --     reset.reset_n
			sci_sclk         => CONNECTED_TO_sci_sclk,         --       sci.sclk
			sci_txd          => CONNECTED_TO_sci_txd,          --          .txd
			sci_txr_n        => CONNECTED_TO_sci_txr_n,        --          .txr_n
			sci_rxd          => CONNECTED_TO_sci_rxd,          --          .rxd
			sci_rxr_n        => CONNECTED_TO_sci_rxr_n,        --          .rxr_n
			motor_ch1_export => CONNECTED_TO_motor_ch1_export, -- motor_ch1.export
			motor_ch2_export => CONNECTED_TO_motor_ch2_export, -- motor_ch2.export
			motor_ch3_export => CONNECTED_TO_motor_ch3_export, -- motor_ch3.export
			motor_ch4_export => CONNECTED_TO_motor_ch4_export, -- motor_ch4.export
			motor_ch5_export => CONNECTED_TO_motor_ch5_export, -- motor_ch5.export
			pwmled_export    => CONNECTED_TO_pwmled_export,    --    pwmled.export
			sysled_export    => CONNECTED_TO_sysled_export     --    sysled.export
		);

