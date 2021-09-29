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
  const [_type, setType] = useState(undefined as string | undefined)
  const [nftAddress, setNftAddress] = useState(undefined as string | undefined)
  const [id, setId] = useState(undefined as string | undefined)

  const contents = gql`
    query Contents(
      $first: Int,
      $skip: Int,
      $type: String,
      $nftAddress: String,
      $id: String,
    ) {
      contents (
        first: $first
        skip: $skip
        where: {
          ${_type ? 'type: $type' : ''}
          ${nftAddress ? 'nftAddress: $nftAddress' : ''}
          ${id ? 'id: $id' : ''}
        }
      ) {
        id
        nftAddress
        nftId
        type
        underlyingWorks {
          id
        }
        purchasableLicenses {
   	  id
        }
        revShareLicenses {
          id
        }
      }
  }`

  const { loading, error, data } = useQuery<{ contents: any[] }>(contents, {
    variables: { first, skip, _type, nftAddress, id }
  })

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

  if (loading) { return <p>loading ...</p> }
  if (error !== undefined) {
    console.error("Error: could not get content", error)
    return <p>Error: could not get content</p>
  }
  if (data === undefined) {
    return <p>No content found.</p>
  }

  const contentElements = (data?.contents ?? []).map((c) => {
    return (
      <li key={c.id}>{ c.nftId } { c.nftAddress } { c.type }</li>
    )
  })

  return (
    <ul>
      { contentElements }
    </ul>
  )
}
