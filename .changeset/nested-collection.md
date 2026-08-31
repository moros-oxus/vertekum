---
"@vertekum/core": patch
"@vertekum/cli": patch
---

Collection files may live in subdirectories — directories are purely organizational. A set's name is its collection-relative path (`brands/rexall`); reading walks recursively, writing creates and cleans up directories, schema `match` globs the relative path, and `vtk resolver -s` paths re-join the tail as the set name (resolutionOrder refs RFC 6901-escape nested names, tolerantly read either way).
