construct_runtime!(
    pub enum TestRuntime where
        Block = Block,
        NodeBlock = NodeBlock,
        UncheckedExtrinsic = UncheckedExtrinsic
    {
        System: frame_system,
        RewardMintGateway: pallet_reward_mint_gateway,
    }
);

impl pallet_reward_mint_gateway::Config for TestRuntime {
    type Event = Event;
}
