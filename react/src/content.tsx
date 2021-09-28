import React, { useState, ChangeEvent } from 'react'
import { gql, useQuery } from '@apollo/client'
import { useWeb3ApiQuery } from '@web3api/react'
import { useMetaMask } from "metamask-react";

export function ContentPage() {
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [pageNumber, setPageNumber] = useState(0)

  function handleItemsPerPageChange(event: ChangeEvent<HTMLInputElement>) {
    setItemsPerPage(parseInt(event.currentTarget.value))
  }

  return (
    <div className="content-page">
      <p>
        <label>
          Items per page:
          <input
            name="itemsPerPage"
            type="number"
            value={itemsPerPage}
            onChange={handleItemsPerPageChange}
          />
        </label>
      </p>
      <p>
        Items per page: {itemsPerPage}
      </p>
      <ContentList
        first={itemsPerPage}
        skip={pageNumber}
      />
    </div>
  )
}



export function ContentList({ first, skip }: { first: number, skip: number }) {

  const { status, connect, account } = useMetaMask();

  const query = gql`
          mutation holdsLicense {
            holdsLicense(
              contractAddress: $contractAddress
              nftAddress: $nftAddress
              nftId: $nftId
              holder: $holder
            )
          }`

  const variables = {
    creatorAddress: account,
    contractAddress: "0x26b4AFb60d6C903165150C6F0AA14F8016bE4aec",
    nftAddress: "0x2612Af3A521c2df9EAF28422Ca335b04AdF3ac66",
    nftId: "1",
    holder: account,
  }

  const { data, errors, loading } = useWeb3ApiQuery<{
    registerPurchasableContent: any
  }>({
    uri: '/ens/testnet/squadprotocol.eth',
    query,
    variables,
  });

  console.log(status)

  if (status === "initializing") {
    return <div>Synchronisation with MetaMask ongoing...</div>
  }
  if (status === "unavailable") {
    return <div>MetaMask not available</div>
  }
  if (status === "notConnected") {
    return <button onClick={connect}>Connect to MetaMask</button>
  }
  if (status === "connecting") {
    return <div>Connecting...</div>
  }
  if (status !== "connected") {
    return <p>Unable to connect to MetaMask</p>
  }

  console.log("connected account", account)

  if (loading) { return <p>loading ...</p> }
  if (errors !== undefined) { return <p>Error :/</p> }
  if (data === undefined) { return <p>No content found.</p> }

  return (
    <div>
      { data }
    </div>
  )
}
