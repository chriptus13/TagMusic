import NodeID3 from 'node-id3-promise'
import axios from 'axios'
import { promises as fs, createWriteStream } from 'fs'
import path from 'path'
import urlencode from 'urlencode'

const baseUrl = "https://api.deezer.com"

main()

async function main() {
    const file = process.argv[2]
    try {
        const stat = await fs.stat(file)
        if (stat.isDirectory())
            await processDir(file)
        else if (stat.isFile())
            await processFile(file)
        else
            console.error('The file must be a MP3 file or a directory!')
    } catch (err) {
        console.error(err)
    }
}

async function processDir(dirName) {
    console.log(dirName)
    try {
        const files = await fs.readdir(dirName)
        for (const file of files) {
            try {
                console.log(dirName + '\\' + file)
                await processFile(dirName + '\\' + file)
            } catch(err) {
                // ignored because not a MP3 file
            }
        }
    } catch (err) {
        console.error(err)
    }
}

async function processFile(file = '') {
    if (typeof file !== 'string' || file.substring(file.indexOf('.') + 1) !== 'mp3')
        throw new Error('The file must be a MP3 file or a directory!')
    try {
        // Get filename
        const fileName = path.basename(file, '.mp3')
        console.log(`Processing: ${fileName}`)

        // Search for music
        const resp = await search(fileName)
        const music = toMusic(resp.data.data[0])

        // Request image
        const imgFile = fileName + '.jpg'
        const img = await getImage(music.album.cover_medium)
        img.data.pipe(createWriteStream(imgFile))

        // Request album
        const { data: album } = await getAlbum(music.album.id)
        const trackNumber = album.tracks.data.findIndex(track => track.title === music.title) + 1
        const genre = album.genres.data[0].name
        const year = new Date(album.release_date).getFullYear()

        const tags = {
            title: music.title,
            artist: music.artist.name,
            album: music.album.title,
            genre,
            year,
            trackNumber,
            APIC: imgFile
        }

        await NodeID3.write(tags, file)

        // Delete image file
        await fs.unlink(imgFile)
    } catch (err) {
        console.error(err)
    }
}

function search(str) {
    const req = {
        method: 'get',
        url: baseUrl + '/search',
        params: { q: urlencode(str) }
    }
    return axios(req)
}

function getImage(url) {
    const req = {
        method: 'get',
        url,
        responseType: 'stream'
    }
    return axios(req)
}

function getAlbum(id) {
    const req = {
        method: 'get',
        url: baseUrl + '/album/' + id
    }
    return axios(req)
}

function toMusic({
    id,
    title: musicTitle,
    artist: {
        id: artistId,
        name
    },
    album: {
        id: albumId,
        title,
        cover_medium
    }
}) {
    return {
        id,
        title: musicTitle,
        artist: {
            id: artistId,
            name
        },
        album: {
            id: albumId,
            title,
            cover_medium
        }
    }
}