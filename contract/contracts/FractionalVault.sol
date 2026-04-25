pragma solidity ^0.8.20;

import "./FractionalNFT.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract FractionalVault {
    IERC721 public nft;
    uint256 public tokenId;
    FractionalNFT public shares;

    mapping(address => uint256) public claimable;

    constructor(
        address _nft,
        uint256 _tokenId,
        uint256 _totalShares
    ) {
        nft = IERC721(_nft);
        tokenId = _tokenId;

        shares = new FractionalNFT(
            "Fractional Share",
            "FSHARE",
            _totalShares,
            address(this)
        );

        nft.transferFrom(msg.sender, address(this), tokenId);
    }

    function depositRevenue() external payable {
        uint256 total = shares.totalSupply();

        for (uint i = 0; i < total; i++) {
            address holder = shares.balanceOf(address(uint160(i))) > 0
                ? address(uint160(i))
                : address(0);

            if (holder != address(0)) {
                uint256 share = shares.balanceOf(holder);
                claimable[holder] += (msg.value * share) / total;
            }
        }
    }

    function claim() external {
        uint256 amount = claimable[msg.sender];
        claimable[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }
}