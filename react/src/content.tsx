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

interface RegisterPurchasableContentProps {
  account: string
  licenseManagerAddress: string
}

export function RegisterPurchasableContent(
  { account, licenseManagerAddress }: RegisterPurchasableContentProps
) {

  const query = gql`
  mutation registerPurchasableContent {
    registerPurchasableContent(
      creatorAddress: $creatorAddress
      licenseManagerAddress: $licenseManagerAddress
      contentMedium: $contentMedium
      content: $content
      contentHash: $contentHash
      metadataMedium: $metadataMedium
      metadata: $metadata
      metadataHash: $metadataHash
      registrant: $registrant
      data: $data
      price: $price
      sharePercentage: $sharePercentage
    )
  }`

  const [content, setContent] = useState("")
  const [metadata, setMetadata] = useState("")
  const [price, setPrice] = useState(0)
  const [data, setData] = useState("")

  const defaultVars = {
      creatorAddress: account,
      licenseManagerAddress,
      registrant: account,
      contentMedium: "UTF8_STRING",
      contentHash: "AUTO",
      metadataMedium: "UTF8_STRING",
      metadataHash: "AUTO",
      sharePercentage: "0",
  }

  const { execute, data: responseData, errors, loading } = useWeb3ApiQuery({
    uri: 'ens/testnet/squadprotocol.eth',
    query,
    variables: Object.assign({}, defaultVars, {
      content,
      metadata,
      price,
      data
    })
  })

  if (responseData !== undefined) {
    console.log("Response Data", responseData)
    return <p>{JSON.stringify(responseData)}</p>
  }

  if (errors !== undefined) {
    console.log("Errors", errors, JSON.stringify(errors))
    return <p>ERROR! check the console</p>
  }

  if (loading) {
    console.log("loading")
    return <p>Loading...</p>
  }

  function handleSubmit(event: ChangeEvent<HTMLFormElement>) {
    console.log("submitted", event)
    if(event) {
      execute()
    }
  }

  function handleWith(setter: React.Dispatch<React.SetStateAction<any>>) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      console.log("handling", event?.target.value)
      setter(event?.target.value)
    }
  }

  // { "type": "string", "underlyingWorks": [] }

  return (
    <div className="register-purchasable-content">
      <form onSubmit={handleSubmit}>
        <label>Content</label>
        <input className="content-input" onChange={handleWith(setContent)} />
        <label>Metadata</label>
        <input className="metadata-input" onChange={handleWith(setMetadata)} />
        <label>price</label>
        <input className="price-input" onChange={handleWith(setPrice)} />
        <label>data</label>
        <input className="data-input" onChange={handleWith(setData)} />
        <button type="submit" className="register-purchasable-content-submit">
          Submit
        </button>
      </form>
    </div>
  )
}

interface ContentListProps {
  first: number
  skip: number
}

export function ContentList({
  first,
  skip,
}: ContentListProps) {

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

  if (account === null) {
    return <button onClick={connect}>Connect to MetaMask</button>
  }

  // TODO make UI read from config
  return (
    <div className="content">
      <ul>
        { contentElements }
      </ul>
      <RegisterPurchasableContent
        account={account}
        licenseManagerAddress="0x630589690929E9cdEFDeF0734717a9eF3Ec7Fcfe"
        />
    </div>
  )
}
