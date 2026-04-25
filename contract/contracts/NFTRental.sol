pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract NFTRental {
    struct Rental {
        address owner;
        address renter;
        uint256 expiresAt;
        uint256 fee;
        bool active;
    }

    mapping(address => mapping(uint256 => Rental)) public rentals;

    function rentOut(
        address nft,
        uint256 tokenId,
        uint256 duration,
        uint256 fee
    ) external {
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);

        rentals[nft][tokenId] = Rental({
            owner: msg.sender,
            renter: address(0),
            expiresAt: 0,
            fee: fee,
            active: true
        });
    }

    function rent(address nft, uint256 tokenId) external payable {
        Rental storage r = rentals[nft][tokenId];
        require(r.active, "Not available");
        require(msg.value >= r.fee, "Insufficient fee");

        r.renter = msg.sender;
        r.expiresAt = block.timestamp + 1 days;

        payable(r.owner).transfer(msg.value);
    }

    function endRental(address nft, uint256 tokenId) external {
        Rental storage r = rentals[nft][tokenId];
        require(block.timestamp >= r.expiresAt, "Still active");

        IERC721(nft).transferFrom(address(this), r.owner, tokenId);
        delete rentals[nft][tokenId];
    }

    function isLocked(address nft, uint256 tokenId) public view returns (bool) {
        return rentals[nft][tokenId].active;
    }
}