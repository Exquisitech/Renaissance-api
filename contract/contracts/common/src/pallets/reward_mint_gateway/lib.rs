pub trait Config: frame_system::Config {
    type Event: From<Event<Self>> + IsType<<Self as frame_system::Config>::Event>;
}


#[pallet::storage]
pub type AuthorizedContracts<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, bool, ValueQuery>;

#[pallet::storage]
pub type ExecutedRewards<T: Config> = StorageMap<_, Blake2_128Concat, Vec<u8>, bool, ValueQuery>;

#[pallet::storage]
pub type TokenCounter<T: Config> = StorageValue<_, u64, ValueQuery>;


#[pallet::event]
#[pallet::generate_deposit(pub(super) fn deposit_event)]
pub enum Event<T: Config> {
    RewardMinted(T::AccountId, u64, Vec<u8>, Vec<u8>), // to, tokenId, rewardId, metadataURI
}

#[pallet::error]
pub enum Error<T> {
    UnauthorizedContract,
    RewardAlreadyExecuted,
    InvalidMetadata,
}
