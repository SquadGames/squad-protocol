import React, { useState, ChangeEvent } from 'react'
import { gql, useQuery } from '@apollo/client'

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
  const query = gql`
{squadNFTs (first: ${first}, skip: ${skip}) {
  id
  creator
  contentURI
  metadataURI
}}
  `
  const { loading, error, data } = useQuery(query)

  if (loading) return <p>loading ...</p>
  if (error) return <p>Error :/</p>

    const items = data.squadNFTs.map((content: any) => {
    return (
      <li key={content.id}>
        ID: {content.id} <br />
        Creator: {content.creator} <br />
        contentURI: {content.contentURI} <br />
        metadataURI: {content.metadataURI} <br />
      </li>
    )
  })

  return (
    <div className="content-list">
      <ul>{items}</ul>
    </div>
  )
}
