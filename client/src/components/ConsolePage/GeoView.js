/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

import Leaflet from 'leaflet'
import React, { useState } from 'react'
import { Alert, Button, Col, Form, Modal, Row } from 'react-bootstrap'
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
} from 'react-leaflet'
import { useSelector } from 'react-redux'

import './GeoView.scss'

const locationField = 'location'

export default function GeoView({ results }) {
  const query = useSelector((state) => state.query.query)

  const [showOptions, setShowOptions] = useState(false)

  const [showLabels, setShowLabels] = useState(true)
  const [mapUrl, setMapUrl] = useState(
    'https://raw.githubusercontent.com/zcreativelabs/react-simple-maps/master/topojson-maps/world-110m.json',
  )

  /*
   * Parses the result object and only shows records with the location field
   * @param results - result object to parse
   */
  const parseResults = (results) => {
    const data =
      results && results.response && results.response.data
        ? results.response.data
        : {}
    const parsedResults = []

    for (var queryKey in data) {
      if (data[queryKey] instanceof Array) {
        parsedResults.push(...data[queryKey].filter((r) => r[locationField]))
      }
    }

    return parsedResults
  }

  /*
   * Instructions for how to use the geo view
   */
  const renderInstructions = () => (
    <div className='error-alert px-3 pt-5 text-center'>
      <Alert variant='danger' className='mb-0'>
        Your objects must contain a predicate or alias named 'location' to use
        the geo display. To show a label, use a predicate or alias named 'name'.
      </Alert>
    </div>
  )

  const renderRecord = (record) => {
    const location = record[locationField]

    switch (location.type) {
      case 'Point':
        return renderPoint(record)
      case 'Polygon':
        return renderPolygon(record)
      case 'MultiPolygon':
        return renderMultiPolygon(record)
      default:
      // Do nothing
    }
  }

  /*
   * Creates a marker based on the location and optional label
   */
  const renderPoint = (record, markerColor = 'blue') => {
    const location = record[locationField]
    const point = location.coordinates.slice().reverse()

    return (
      <Marker position={point} color={markerColor}>
        <Popup>{record.name || 'Unnamed Marker'}</Popup>
      </Marker>
    )
  }

  /*
   * Creates a circle marker based on the location and optional label
   */
  const renderCircleMarker = (record, markerColor = 'blue') => {
    const location = record[locationField]
    const point = location.coordinates.slice().reverse()

    return (
      <CircleMarker center={point} color={markerColor}>
        <Popup>{record.name || 'Unnamed Marker'}</Popup>
      </CircleMarker>
    )
  }

  /*
   * Renders a polygon
   */
  const renderPolygon = (record, polygonColor = 'blue') => {
    const location = record[locationField]
    const points = location.coordinates.map((a) =>
      a.map((c) => c.slice().reverse()),
    )

    return (
      <Polygon positions={points} color={polygonColor}>
        <Popup>{record.name || 'Unnamed Polygon'}</Popup>
      </Polygon>
    )
  }

  /*
   * Renders a multipolygon
   */
  const renderMultiPolygon = (record) => {
    const location = record[locationField]
    let i = 0

    return location.coordinates
      .map((p) => ({
        name: `${record.name || 'Unnamed MultiPolygon'} ${i++}`,
        location: {
          coordinates: p,
        },
      }))
      .map(renderPolygon)
  }

  /*
   * Renders the query on the map, based on the geo function used
   */
  const renderQuery = () => {
    const queryRegex = /func:\s*(.*)\(([^)]*)/
    const regexResult = queryRegex.exec(query)

    if (regexResult) {
      const [, func, args] = regexResult

      switch (func) {
        case 'near':
          const nearRegex = /(\[.*]*\]),\s*(\d*)/
          const [, coordinate, distance] = nearRegex.exec(args)

          // TODO: Render distance somehow
          return (
            <Circle
              center={JSON.parse(coordinate).slice().reverse()}
              radius={JSON.parse(distance)}
              color='red'
            >
              <Popup>
                Query: {func}({args})
              </Popup>
            </Circle>
          )

        case 'within':
        case 'contains':
        case 'intersects':
          const generalRegex = /(\[.*)/
          const [, coordinates] = generalRegex.exec(args)

          // If coordinates are a polygon, draw polygon, otherwise, draw point
          const renderFunc = coordinates.replace(/[\s\n]/g, '').includes('[[[')
            ? renderPolygon
            : renderCircleMarker
          return renderFunc(
            {
              name: `Query: ${func}(${args})`,
              location: {
                coordinates: JSON.parse(coordinates),
              },
            },
            'red',
          )
        default:
          // Do nothing?
          break
      }
    }
  }

  const calculateBounds = (records) => {
    const coords = []

    for (const record of records) {
      const location = record[locationField]

      switch (location.type) {
        case 'Point':
          coords.push(Leaflet.latLng(location.coordinates.slice().reverse()))
          break

        case 'Polygon':
          for (const points of location.coordinates) {
            for (const c of points) {
              coords.push(Leaflet.latLng(c.slice().reverse()))
            }
          }
          break

        case 'MultiPolygon':
          for (const polygon of location.coordinates) {
            for (const points of polygon) {
              for (const c of points) {
                coords.push(Leaflet.latLng(c.slice().reverse()))
              }
            }
          }
          break
        default:
          // Weird location.type -- ignore?
          break
      }
    }

    return Leaflet.latLngBounds(coords).pad(0.1)
  }

  const handleClose = () => setShowOptions(false)
  const handleShow = () => setShowOptions(true)

  // Render starts here
  const locations = parseResults(results).filter((e) => e.location.type)
  const bounds = locations.length > 0 ? calculateBounds(locations) : undefined
  const center = locations.length > 0 ? bounds.getCenter() : [0, 0]

  return (
    <>
      <div className='map-wrapper'>
        {/* Options button */}
        <div className='pr-5 text-right'>
          <Button
            variant='light'
            onClick={handleShow}
            className='options-button mt-2'
          >
            <i className='fa fa-cog' aria-hidden='true' />
          </Button>
        </div>

        {/* Usage instructions */}
        {locations.length === 0 && renderInstructions()}

        <MapContainer
          zoom={19}
          maxZoom={19}
          center={center}
          bounds={bounds}
          className='map'
        >
          <TileLayer
            attribution='&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          />
          {/* Render records */}
          {locations.map(renderRecord)}
          {/* Render query */}
          {renderQuery()}
        </MapContainer>
      </div>

      {/* Options modal */}
      <Modal show={showOptions} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Options</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form.Group>
            <Form.Check
              label='Show Labels'
              checked={showLabels}
              onChange={() => setShowLabels(!showLabels)}
            />
          </Form.Group>

          <Form.Group as={Row} controlId='formPlaintextEmail'>
            <Form.Label column sm='3'>
              Map URL
            </Form.Label>
            <Col sm='9'>
              <Form.Control
                onChange={(evt) => setMapUrl(evt.target.value)}
                value={mapUrl}
              />
            </Col>
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant='secondary' onClick={handleClose}>
            Close
          </Button>
          <Button variant='primary' onClick={handleClose}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
